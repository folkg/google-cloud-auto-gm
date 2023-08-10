import assert from "assert";
import { logger } from "firebase-functions";
import {
  ITeamFirestore,
  ITeamOptimizer,
} from "../../common/interfaces/ITeam.js";
import { updateTeamFirestore } from "../../common/services/firebase/firestore.service.js";
import { getPacificTimeDateString } from "../../common/services/utilities.service.js";
import { putLineupChanges } from "../../common/services/yahooAPI/yahooAPI.service.js";
import {
  initStartingGoalies,
  initStartingPitchers,
} from "../../common/services/yahooAPI/yahooStartingPlayer.service.js";
import {
  createPlayersTransactions,
  getTopAvailablePlayers,
  postTransactions,
} from "../../transactions/services/processTransactions.service.js";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";
import { LineupChanges } from "../interfaces/LineupChanges.js";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service.js";
import { TopAvailablePlayers } from "./yahooTopAvailablePlayersBuilder.service.js";

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
    uid,
    topAvailablePlayerCandidates
  );
}

// TODO: These two functions should maybe be moved elsewhere. Firestore service probably.
export function enrichTeamsWithFirestoreSettings(
  yahooTeams: ITeamOptimizer[],
  firestoreTeams: ITeamFirestore[]
): ITeamOptimizer[] {
  return yahooTeams.map((yahooTeam) => {
    const firestoreTeam = firestoreTeams.find(
      (firestoreTeam) => firestoreTeam.team_key === yahooTeam.team_key
    );

    return {
      allow_adding: firestoreTeam?.allow_adding ?? false,
      allow_dropping: firestoreTeam?.allow_dropping ?? false,
      allow_add_drops: firestoreTeam?.allow_add_drops ?? false,
      allow_waiver_adds: firestoreTeam?.allow_waiver_adds ?? false,
      allow_transactions: firestoreTeam?.allow_transactions ?? false,
      ...yahooTeam,
    };
  });
}

async function patchTeamChangesInFirestore(
  yahooTeams: ITeamOptimizer[],
  firestoreTeams: ITeamFirestore[]
): Promise<void> {
  const sharedKeys = Object.keys(firestoreTeams[0]).filter(
    (key) => key in yahooTeams[0]
  );

  for (const firestoreTeam of firestoreTeams) {
    const yahooTeam = yahooTeams.find(
      (yahooTeam) => firestoreTeam.team_key === yahooTeam.team_key
    );
    if (!yahooTeam) return;

    const differences: { [key: string]: any } = {};
    sharedKeys.forEach((key) => {
      const yahooValue = yahooTeam[key as keyof ITeamOptimizer];
      const firestoreValue = firestoreTeam[key as keyof ITeamFirestore];
      if (yahooValue !== firestoreValue) {
        differences[key] = yahooValue;
      }
    });

    if (Object.keys(differences).length > 0) {
      logger.info(
        `different values between yahoo and firestore teams for team ${yahooTeam.team_key}`,
        differences
      );
      await updateTeamFirestore(
        firestoreTeam.uid,
        yahooTeam.team_key,
        differences
      );
    }
  }
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
  let result: ITeamOptimizer[] = originalTeams;

  const teams = getTeamsWithSameDayTransactions(originalTeams);

  const [dropPlayerTransactions, lineupChanges, addSwapTransactions] =
    await createPlayersTransactions(teams, topAvailablePlayerCandidates);

  const transactionData = {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };

  let transactionsCompleted: boolean;
  try {
    transactionsCompleted = await postTransactions(transactionData, uid);
  } catch (error) {
    logger.error("Transaction data: ", { transactionData });
    logger.error("Original teams object: ", { teams });
    throw error;
  }

  if (transactionsCompleted) {
    const teamKeys: string[] = originalTeams.map((t) => t.team_key);
    result = await fetchRostersFromYahoo(teamKeys, uid);
    result = enrichTeamsWithFirestoreSettings(result, firestoreTeams);
  }

  return result;
}

async function processTransactionsForNextDayTeams(
  originalTeams: ITeamOptimizer[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  uid: string
): Promise<void> {
  const teams = getTeamsForNextDayTransactions(originalTeams);

  // pre-check to see if we need to do anything using today's roster.
  // May not catch 100% if the user made some changes, but it will catch most.
  const [potentialDrops, _, potentialAddSwaps] =
    await createPlayersTransactions(teams, topAvailablePlayerCandidates);

  if (!potentialDrops && !potentialAddSwaps) {
    return;
  }

  await processTomorrowsTransactions(teams, uid, topAvailablePlayerCandidates);
}

async function processTomorrowsTransactions(
  teams: ITeamOptimizer[] | ITeamFirestore[],
  uid: string,
  topAvailablePlayerCandidates: TopAvailablePlayers
) {
  const teamKeys: string[] = teams.map((t) => t.team_key);
  const tomorrowsTeams = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );

  const [dropPlayerTransactions, lineupChanges, addSwapTransactions] =
    await createPlayersTransactions(
      tomorrowsTeams,
      topAvailablePlayerCandidates
    );

  const transactionData = {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };

  try {
    await postTransactions(transactionData, uid);
  } catch (error) {
    logger.error("Transaction data: ", { transactionData });
    logger.error("Original teams object: ", { teams });
    throw error;
  }
}

function getTeamsWithSameDayTransactions(
  teams: ITeamOptimizer[]
): ITeamOptimizer[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      team.weekly_deadline === "intraday" &&
      team.edit_key === team.coverage_period
  );
}

function getTeamsForNextDayTransactions(
  teams: ITeamOptimizer[]
): ITeamOptimizer[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      team.weekly_deadline === "" &&
      team.edit_key !== team.coverage_period
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
