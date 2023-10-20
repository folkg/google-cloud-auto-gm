import assert from "assert";
import { logger } from "firebase-functions";
import {
  ITeamFirestore,
  ITeamOptimizer,
} from "../../common/interfaces/ITeam.js";
import {
  enrichTeamsWithFirestoreSettings,
  patchTeamChangesInFirestore,
} from "../../common/services/firebase/firestoreUtils.service.js";
import {
  getCurrentPacificNumDay,
  getPacificTimeDateString,
} from "../../common/services/utilities.service.js";
import { putLineupChanges } from "../../common/services/yahooAPI/yahooAPI.service.js";
import {
  initStartingGoalies,
  initStartingPitchers,
} from "../../common/services/yahooAPI/yahooStartingPlayer.service.js";
import { isFirstRunOfTheDay } from "../../scheduleSetLineup/services/scheduleSetLineup.service.js";
import {
  createPlayersTransactions,
  getTopAvailablePlayers,
  postTransactions,
  sendPotentialTransactionEmail,
} from "../../transactions/services/processTransactions.service.js";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";
import { LineupChanges } from "../interfaces/LineupChanges.js";
import { PlayerTransaction } from "../interfaces/PlayerTransaction.js";
import { fetchRostersFromYahoo } from "../../common/services/yahooAPI/yahooLineupBuilder.service.js";
import { TopAvailablePlayers } from "../../common/services/yahooAPI/yahooTopAvailablePlayersBuilder.service.js";

/**
 * Will optimize the starting lineup for a specific users teams
 *
 * @export
 * @async
 * @param {(string)} uid - The user id
 * @param {(any[])} firestoreTeams - The team objects from Firestore
 * @return {unknown}
 */
export async function setUsersLineup(
  uid: string,
  firestoreTeams: ITeamFirestore[]
): Promise<void> {
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");
  if (firestoreTeams.length === 0) {
    logger.log(`No teams for user ${uid}`);
    return;
  }

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);

  let usersTeams: ITeamOptimizer[] = await fetchRostersFromYahoo(teamKeys, uid);
  if (usersTeams.length === 0) {
    return;
  }
  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);
  patchTeamChangesInFirestore(usersTeams, firestoreTeams); // don't await

  await initializeGlobalStartingPlayers(firestoreTeams);

  const topAvailablePlayerCandidates: TopAvailablePlayers =
    await getTopAvailablePlayers(firestoreTeams, uid);

  usersTeams = await processTransactionsForIntradayTeams(
    usersTeams,
    firestoreTeams,
    topAvailablePlayerCandidates,
    uid
  );

  usersTeams = await processLineupChanges(usersTeams, uid);

  await processTransactionsForNextDayTeams(
    usersTeams,
    firestoreTeams,
    topAvailablePlayerCandidates,
    uid
  );
}

export async function performWeeklyLeagueTransactions(
  uid: string,
  firestoreTeams: ITeamFirestore[]
): Promise<void> {
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");
  if (firestoreTeams.length === 0) {
    logger.log(`No weekly teams for user ${uid}`);
    return;
  }

  const topAvailablePlayerCandidates: TopAvailablePlayers =
    await getTopAvailablePlayers(firestoreTeams, uid);

  await processTomorrowsTransactions(
    firestoreTeams,
    firestoreTeams,
    uid,
    topAvailablePlayerCandidates
  );
}

async function processLineupChanges(
  teams: ITeamOptimizer[],
  uid: string
): Promise<ITeamOptimizer[]> {
  const result: ITeamOptimizer[] = [];

  const allLineupChanges: LineupChanges[] = [];
  for (const team of teams) {
    const lo = new LineupOptimizer(team);
    lo.optimizeStartingLineup();

    const lineupChanges = lo.lineupChanges;
    if (lineupChanges) {
      allLineupChanges.push(lineupChanges);
    }

    result.push(lo.getCurrentTeamState());

    // TODO: will log any errors, we could remove this later once we're confident in the optimizer
    const isOptimalLineup = lo.isSuccessfullyOptimized();
    if (!isOptimalLineup) {
      logger.error(
        `Original roster for problematic team ${team.team_key}`,
        team
      );
    }
  }

  if (allLineupChanges.length > 0) {
    try {
      await putLineupChanges(allLineupChanges, uid);
    } catch (error) {
      logger.error(error);
      logger.error("Lineup changes object: ", { allLineupChanges });
      logger.error("Original teams object: ", { teams });
      throw error;
    }
  }

  return result;
}

async function processTransactionsForIntradayTeams(
  originalTeams: ITeamOptimizer[],
  firestoreTeams: ITeamFirestore[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  uid: string
): Promise<ITeamOptimizer[]> {
  const teams = getTeamsWithSameDayTransactions(originalTeams);

  await processManualTransactions(teams, topAvailablePlayerCandidates, uid);

  let result: ITeamOptimizer[] = originalTeams;

  const transactionsCompleted: boolean = await processAutomaticTransactions(
    teams,
    topAvailablePlayerCandidates,
    uid
  );

  if (transactionsCompleted) {
    const teamKeys: string[] = originalTeams.map((t) => t.team_key);
    result = await fetchRostersFromYahoo(teamKeys, uid);
    result = enrichTeamsWithFirestoreSettings(result, firestoreTeams);
  }

  return result;
}

async function processTransactionsForNextDayTeams(
  originalTeams: ITeamOptimizer[],
  firestoreTeams: ITeamFirestore[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  uid: string
): Promise<void> {
  const teams = getTeamsForNextDayTransactions(originalTeams);

  // pre-check to see if we need to do anything using today's roster.
  // May not catch 100% if the user made some changes, but it will catch most.
  const {
    dropPlayerTransactions: potentialDrops,
    addSwapTransactions: potentialAddSwaps,
  } = await createPlayersTransactions(teams, topAvailablePlayerCandidates);

  if (!potentialDrops && !potentialAddSwaps) {
    return;
  }

  await processTomorrowsTransactions(
    teams,
    firestoreTeams,
    uid,
    topAvailablePlayerCandidates
  );
}

async function processTomorrowsTransactions(
  teams: ITeamOptimizer[] | ITeamFirestore[],
  firestoreTeams: ITeamFirestore[],
  uid: string,
  topAvailablePlayerCandidates: TopAvailablePlayers
) {
  const teamKeys: string[] = teams.map((t) => t.team_key);
  let tomorrowsTeams = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );

  tomorrowsTeams = enrichTeamsWithFirestoreSettings(
    tomorrowsTeams,
    firestoreTeams
  );

  await processManualTransactions(
    tomorrowsTeams,
    topAvailablePlayerCandidates,
    uid
  );

  await processAutomaticTransactions(
    tomorrowsTeams,
    topAvailablePlayerCandidates,
    uid
  );
}

async function processAutomaticTransactions(
  teams: ITeamOptimizer[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  uid: string
): Promise<boolean> {
  const teamsWithAutoTransactions = teams.filter(
    (t) => t.automated_transaction_processing
  );

  if (teamsWithAutoTransactions.length === 0) {
    return false;
  }

  const { dropPlayerTransactions, lineupChanges, addSwapTransactions } =
    await createPlayersTransactions(
      teamsWithAutoTransactions,
      topAvailablePlayerCandidates
    );

  const transactionData = {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };

  try {
    const result = await postTransactions(transactionData, uid);
    return result.success;
  } catch (error) {
    logger.error("Transaction data: ", { transactionData });
    logger.error("Original teams object: ", { teamsWithAutoTransactions });
    throw error;
  }
}

async function processManualTransactions(
  teams: ITeamOptimizer[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  uid: string
): Promise<void> {
  // Only process teams on the first run of the day. Only propose changes once per day.
  const teamsToCheck = teams.filter(
    (t) => !t.automated_transaction_processing && isFirstRunOfTheDay()
  );

  if (teamsToCheck.length === 0) {
    return;
  }

  const { dropPlayerTransactions, addSwapTransactions } =
    await createPlayersTransactions(teamsToCheck, topAvailablePlayerCandidates);

  const proposedTransactions: PlayerTransaction[] = (
    dropPlayerTransactions ?? []
  )
    .concat(addSwapTransactions ?? [])
    .flat();

  if (proposedTransactions.length > 0) {
    sendPotentialTransactionEmail(proposedTransactions, uid);
  }
}

export function getTeamsWithSameDayTransactions(
  teams: ITeamOptimizer[]
): ITeamOptimizer[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping || team.allow_add_drops) &&
      (team.weekly_deadline === "intraday" || team.game_code === "nfl")
  );
}

export function getTeamsForNextDayTransactions(
  teams: ITeamOptimizer[]
): ITeamOptimizer[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping || team.allow_add_drops) &&
      (team.weekly_deadline === "" ||
        team.weekly_deadline === (getCurrentPacificNumDay() + 1).toString()) &&
      team.game_code !== "nfl"
  );
}

async function initializeGlobalStartingPlayers(
  firestoreTeams: ITeamFirestore[]
) {
  const hasNHLTeam = firestoreTeams.some((team) => team.game_code === "nhl");
  if (hasNHLTeam) {
    await initStartingGoalies();
  }
  const hasMLBTeam = firestoreTeams.some((team) => team.game_code === "mlb");
  if (hasMLBTeam) {
    await initStartingPitchers();
  }
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPacificTimeDateString(tomorrow);
}
