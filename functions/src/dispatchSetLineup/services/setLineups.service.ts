import assert from "assert";
import { logger } from "firebase-functions";
import { IPlayer } from "../../common/interfaces/IPlayer.js";
import {
  ITeamFirestore,
  ITeamOptimizer,
} from "../../common/interfaces/ITeam.js";
import { updateTeamFirestore } from "../../common/services/firebase/firestore.service.js";
import { getPacificTimeDateString } from "../../common/services/utilities.service.js";
import {
  postRosterAddDropTransaction,
  putLineupChanges,
} from "../../common/services/yahooAPI/yahooAPI.service.js";
import {
  initStartingGoalies,
  initStartingPitchers,
} from "../../common/services/yahooAPI/yahooStartingPlayer.service.js";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";
import { LineupChanges } from "../interfaces/LineupChanges.js";
import { PlayerTransaction } from "../interfaces/PlayerTransaction.js";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service.js";
import {
  TopAvailablePlayers,
  fetchTopAvailablePlayersFromYahoo,
} from "./yahooTopAvailablePlayersBuilder.service.js";

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

  // TODO: Add tests for the new addPlayerCandidate functionality
  // Create new spec for setLineups.service.spec.ts
  // I'm thinking we fetch players for one team, and then multiple teams at once and make sure the results are properly merged into arrays of 50 players for each team

  // TODO: Do we want to initiate the promises here, or wait until we know usersTeams.length > 0?
  // Pro: We can get the top available players while we wait for the usersTeamsPromise to resolve
  // Con: We are initiating a bunch of promises that we may not need, using up API calls

  // TODO: Check pace before fetching add candidates? Could check each team inside the following function
  const [
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ] = generateTopAvailablePlayerPromises(firestoreTeams, uid);

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);

  let usersTeams: ITeamOptimizer[] = await fetchRostersFromYahoo(teamKeys, uid);
  if (usersTeams.length === 0) {
    return;
  }
  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);
  patchTeamChangesInFirestore(usersTeams, firestoreTeams); // don't await

  await initializeGlobalStartingPlayers(firestoreTeams);

  const addCandidates: TopAvailablePlayers = await mergeTopAvailabePlayers(
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise
  );

  usersTeams = await processTransactionsForIntradayTeams(
    usersTeams,
    firestoreTeams,
    uid,
    addCandidates
  );
  usersTeams = await processLineupChanges(usersTeams, uid);
  await processTransactionsForNextDayTeams(usersTeams, uid, addCandidates);
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

  // TODO: Should we just do this daily once for all teams and remove it from the other flow?

  const [
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ] = generateTopAvailablePlayerPromises(firestoreTeams, uid);

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);
  let usersTeams = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );
  if (usersTeams.length === 0) return;

  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);

  const topAvailablePlayerCandidates: TopAvailablePlayers =
    await mergeTopAvailabePlayers(
      topAvailablePlayersPromise,
      nflTopAvailablePlayersPromise,
      restTopAvailablePlayersPromise
    );
  await processPlayerTransactions(
    usersTeams,
    topAvailablePlayerCandidates,
    uid
  );
}

function enrichTeamsWithFirestoreSettings(
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
  uid: string,
  topAvailablePlayerCandidates: TopAvailablePlayers
): Promise<ITeamOptimizer[]> {
  let result: ITeamOptimizer[] = originalTeams;

  const teams = getTeamsWithSameDayTransactions(originalTeams);

  const transactionsCompleted: boolean = await processPlayerTransactions(
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
  uid: string,
  topAvailablePlayerCandidates: TopAvailablePlayers
): Promise<void> {
  // TODO: Should we just go ahead and fetch tomorrow's lineup here instead of doing pre-checks?
  const teams = getTeamsForNextDayTransactions(originalTeams);

  const [potentialLineupChanges, poentitalTransactions] =
    await createPlayersTransactions(teams, topAvailablePlayerCandidates);
  if (!potentialLineupChanges && !poentitalTransactions) {
    return;
  }

  const teamKeys: string[] = teams.map((t) => t.team_key);
  const tomorrowsTeams = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );

  await processPlayerTransactions(
    tomorrowsTeams,
    topAvailablePlayerCandidates,
    uid
  );
}

async function processPlayerTransactions(
  teams: ITeamOptimizer[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  uid: string
): Promise<boolean> {
  let result = false;

  const [lineupChanges, transactions] = await createPlayersTransactions(
    teams,
    topAvailablePlayerCandidates
  );

  // Adding players may require lineup changes to move players from roster to IL, so we need to put lineup changes first
  if (lineupChanges) {
    try {
      await putLineupChanges(lineupChanges, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForSameDayChanges()", error);
      logger.error("Lineup changes object: ", { lineupChanges });
      logger.error("Original teams object: ", { teams });
      throw error;
    }
    result = true;
  }

  if (transactions) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForSameDayChanges()", error);
      logger.error("Transactions object: ", { transactions });
      logger.error("Original teams object: ", { teams });
      // continue the function even if posting transactions fails, we can still proceed to optimize lineup
    }
    result = true;
  }

  return result;
}

async function createPlayersTransactions(
  teams: ITeamOptimizer[],
  allAddCandidates: TopAvailablePlayers
): Promise<[LineupChanges[] | null, PlayerTransaction[][] | null]> {
  const allPlayerTransactions: PlayerTransaction[][] = [];
  const allLineupChanges: LineupChanges[] = [];

  for (const team of teams) {
    const lo = new LineupOptimizer(team);

    if (team.allow_dropping) {
      lo.generateDropPlayerTransactions();
    }

    const addCandidates: IPlayer[] = allAddCandidates[team.team_key];

    if (addCandidates?.length > 0) {
      lo.addCandidates = addCandidates;

      if (team.allow_adding) {
        lo.generateAddPlayerTransactions();
      }
      // TODO: Can the add/drop run to find add/drops before we post the other ones? I think so...
      if (team.allow_add_drops) {
        // lo.generateAddDropPlayerTransactions();
      }
    }

    const lc: LineupChanges | null = lo.lineupChanges;
    if (lc) {
      allLineupChanges.push(lc);
    }

    const pt: PlayerTransaction[] | null = lo.playerTransactions;
    if (pt) {
      allPlayerTransactions.push(pt);
    }
  }

  return [
    allLineupChanges.length > 0 ? allLineupChanges : null,
    allPlayerTransactions.length > 0 ? allPlayerTransactions : null,
  ];
}

async function postAllTransactions(
  playerTransactions: PlayerTransaction[][],
  uid: string
): Promise<void> {
  const allTransactionsPromises = playerTransactions
    .flat()
    .map((transaction) => postRosterAddDropTransaction(transaction, uid));

  const results = await Promise.allSettled(allTransactionsPromises);

  let error = false;
  results.forEach((result) => {
    if (result.status === "rejected") {
      error = true;
      logger.error(
        `Error in postAllTransactions() for User: ${uid}: ${result.reason}`
      );
    }
  });
  if (error) {
    throw new Error("Error in postAllTransactions()");
  }

  // // Process all transactions in series
  // const allTransactions = playerTransactions.flat();
  // for (const transaction of allTransactions) {
  //   try {
  //     await postRosterAddDropTransaction(transaction, uid);
  //   } catch (err: any) {
  //     logger.error(
  //       `Error in postAllTransactions() for User: ${uid}: ${err.message}`
  //     );
  //     logger.error("Transaction: ", transaction);
  //     throw err;
  //   }
  // }

  // TODO: Send notification email after every successful set of transactions
  // TODO: When to send email for confirmation, if we have that setting on?
  // TODO: Send the email with debugging information - such as player added name, ownership score. Who moved to IR. Any unfilled or critical positions on team.
}

function getTeamsWithSameDayTransactions(
  teams: ITeamOptimizer[]
): ITeamOptimizer[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      (team.weekly_deadline === "intraday" || team.weekly_deadline === "") &&
      team.edit_key === team.coverage_period
  );
}

function getTeamsForNextDayTransactions(
  teams: ITeamOptimizer[]
): ITeamOptimizer[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      (team.weekly_deadline === "intraday" || team.weekly_deadline === "") &&
      team.edit_key !== team.coverage_period
  );
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPacificTimeDateString(tomorrow);
}

export function generateTopAvailablePlayerPromises(
  firestoreTeams: ITeamFirestore[],
  uid: string
) {
  const nflTeamKeysAddingPlayers: string[] = firestoreTeams
    .filter((team) => team.allow_adding && team.game_code === "nfl")
    .map((team) => team.team_key);
  const restTeamKeysAddingPlayers: string[] = firestoreTeams
    .filter((team) => team.allow_adding && team.game_code !== "nfl")
    .map((team) => team.team_key);
  const allTeamKeysAddingPlayers: string[] = nflTeamKeysAddingPlayers.concat(
    restTeamKeysAddingPlayers
  );

  if (allTeamKeysAddingPlayers.length === 0) {
    return [Promise.resolve({}), Promise.resolve({}), Promise.resolve({})];
  }

  const topAvailablePlayersPromise: Promise<TopAvailablePlayers> =
    fetchTopAvailablePlayersFromYahoo(
      allTeamKeysAddingPlayers,
      uid,
      "A",
      "sort=R_PO"
    );

  let nflTopAvailablePlayersPromise: Promise<TopAvailablePlayers>;
  if (nflTeamKeysAddingPlayers.length > 0) {
    nflTopAvailablePlayersPromise = fetchTopAvailablePlayersFromYahoo(
      nflTeamKeysAddingPlayers,
      uid,
      "A",
      "sort=AR_L4W;sort_type=last4weeks"
    );
  } else {
    nflTopAvailablePlayersPromise = Promise.resolve({});
  }

  let restTopAvailablePlayersPromise: Promise<TopAvailablePlayers>;
  if (restTeamKeysAddingPlayers.length > 0) {
    restTopAvailablePlayersPromise = fetchTopAvailablePlayersFromYahoo(
      restTeamKeysAddingPlayers,
      uid,
      "A",
      "sort=AR_L14;sort_type=biweekly"
    );
  } else {
    restTopAvailablePlayersPromise = Promise.resolve({});
  }

  return [
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ];
}

export async function mergeTopAvailabePlayers(
  topAvailablePlayersPromise: Promise<TopAvailablePlayers>,
  nflTopAvailablePlayersPromise: Promise<TopAvailablePlayers>,
  restTopAvailablePlayersPromise: Promise<TopAvailablePlayers>
): Promise<TopAvailablePlayers> {
  const result: TopAvailablePlayers = {};

  const resolvedPlayers = await Promise.all([
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ]);

  resolvedPlayers.forEach((resolvedPromise: TopAvailablePlayers) => {
    Object.keys(resolvedPromise).forEach((teamKey) => {
      if (Array.isArray(result[teamKey])) {
        result[teamKey].push(...resolvedPromise[teamKey]);
      } else {
        result[teamKey] = resolvedPromise[teamKey];
      }
    });
  });

  return result;
}
