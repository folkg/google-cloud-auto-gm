import assert from "assert";
import { logger } from "firebase-functions";
import { IPlayer } from "../../common/interfaces/IPlayer.js";
import {
  ITeamFirestore,
  ITeamOptimizer,
} from "../../common/interfaces/ITeam.js";
import { updateTeamFirestore } from "../../common/services/firebase/firestore.service.js";
import {
  getPacificTimeDateString,
  is2DArrayEmpty,
} from "../../common/services/utilities.service.js";
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
  if (usersTeams.length === 0) return;

  await initializeGlobalStartingPlayers(firestoreTeams);

  patchTeamChangesInFirestore(usersTeams, firestoreTeams); // don't await

  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);

  const addCandidates: TopAvailablePlayers = await mergeTopAvailabePlayers(
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise
  );

  usersTeams = await processTransactionsForSameDayChanges(
    usersTeams,
    uid,
    addCandidates
  );
  usersTeams = await processTodaysLineupChanges(usersTeams, uid);
  await processTransactionsForNextDayChanges(usersTeams, uid, addCandidates);
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

  const transactions = getPlayerTransactions(
    usersTeams,
    topAvailablePlayerCandidates
  );
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in performTransactionsForWeeklyLeagues()");
      logger.error("User teams object: ", { usersTeams });
    }
  }
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

async function processTodaysLineupChanges(
  teams: ITeamOptimizer[],
  uid: string
): Promise<ITeamOptimizer[]> {
  const result: ITeamOptimizer[] = [];

  const allLineupChanges: LineupChanges[] = [];
  for (const team of teams) {
    const lo = new LineupOptimizer(team);
    lo.optimizeStartingLineup();
    const lineupChanges = lo.lineupChanges;
    result.push(lo.getCurrentTeamState());
    // will log any errors, we could remove this later once we're confident in the optimizer
    const isOptimalLineup = lo.isSuccessfullyOptimized();
    if (!isOptimalLineup) {
      logger.error(
        `Original roster for problematic team ${team.team_key}`,
        team
      );
    }
    if (lineupChanges) {
      allLineupChanges.push(lineupChanges);
    }
  }

  if (allLineupChanges.length > 0) {
    // if there is a failure calling the Yahoo API, an error will be thrown, and we will let it propagate up
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

async function processTransactionsForSameDayChanges(
  originalTeams: ITeamOptimizer[],
  uid: string,
  topAvailablePlayerCandidates: TopAvailablePlayers
): Promise<ITeamOptimizer[]> {
  let result: ITeamOptimizer[] = originalTeams;

  const teams = getTeamsWithSameDayTransactions(originalTeams);
  // 1. getDropPlayerTransactions. Should modify the teams object as well. Maybe rename this function to not be "get", but "create".
  // 2. postDropPlayerTransactions - officially drops players from teams
  // 2a - do I need to? Or just pretend they're dropped for now? Does the add or add/drop depend on the drop being successful?
  // 3. getAddPlayerTransactions - moves players from lineup to IL and generates add player transactions
  // 4. putAddPlayerLineupChanges - officially moves players from lineup to BN
  // 4a. This is required. It will put the lineup changes moving players from lineup to IL, will there be others involving the dropped players, and are they desired or not desired? I think there are no roster moves made. IL players to BN will not be done until the roster spot is freed. But will that freed roster spot then be filled by add player? It's complicated. Or will that extra spot be used to move player?
  // 5. postAddPlayerTransactions - officially adds players to teams
  // 6. refetchAndPatchTeams - refetches teams from Yahoo and patches the teams object with the new players
  const transactions = getPlayerTransactions(
    teams,
    topAvailablePlayerCandidates
  );
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForSameDayChanges()", error);
      logger.error("Original teams object: ", { originalTeams });
    }
    // returns a new deep copy of the teams with the updated player transactions
    result = await refetchAndPatchTeams(transactions, uid, originalTeams);
  }

  return result;
}

async function processTransactionsForNextDayChanges(
  originalTeams: ITeamOptimizer[],
  uid: string,
  topAvailablePlayerCandidates: TopAvailablePlayers
): Promise<void> {
  // check if there are any transactions required for teams with next day changes
  // this pre-check is to save on Yahoo API calls
  const teams = getTeamsForNextDayTransactions(originalTeams);
  const potentialTransactions = getPlayerTransactions(
    teams,
    topAvailablePlayerCandidates
  );

  if (is2DArrayEmpty(potentialTransactions)) {
    return;
  }

  // if there are transactions required, get tomorrow's rosters and perform the transactions
  const uniqueTeamKeys = getTeamKeysFromTransactions(potentialTransactions);
  const tomorrowsTeams = await fetchRostersFromYahoo(
    uniqueTeamKeys,
    uid,
    tomorrowsDateAsString()
  );

  const transactions = getPlayerTransactions(
    tomorrowsTeams,
    topAvailablePlayerCandidates
  );
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForNextDayChanges()", error);
      logger.error("Original teams object: ", { originalTeams });
    }
  }
}

async function getPlayerTransactions2(
  teams: ITeamOptimizer[],
  allAddCandidates: TopAvailablePlayers
) {
  const result: PlayerTransaction[][] = [];
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
        const lineupChanges = lo.lineupChanges;
        if (lineupChanges) {
          allLineupChanges.push(lineupChanges);
        }
      }
      if (team.allow_add_drops) {
        // TODO: Can add add/dropping here as well
        // lo.generateAddDropPlayerTransactions();
      }
    }

    if (allLineupChanges.length > 0) {
      // if there is a failure calling the Yahoo API, an error will be thrown, and we will let it propagate up
      try {
        await putLineupChanges(allLineupChanges, uid);
      } catch (error) {
        logger.error(error);
        logger.error("Lineup changes object: ", { allLineupChanges });
        logger.error("Original teams object: ", { teams });
        throw error;
      }
    }

    // TODO: This needs to be rearranged.
    const playerTransactions: PlayerTransaction[] = lo.playerTransactions;
    if (playerTransactions.length > 0) {
      result.push(playerTransactions);
    }
  }

  return result;
}

function getPlayerTransactions(
  teams: ITeamOptimizer[],
  allAddCandidates: TopAvailablePlayers
): PlayerTransaction[][] {
  const result: PlayerTransaction[][] = [];

  for (const team of teams) {
    const lo = new LineupOptimizer(team);

    if (team.allow_dropping) {
      lo.generateDropPlayerTransactions();
      // TODO: Need to put drop transactions to Yahoo before optimizing
      // Roster movement from adding will need to be posted first, then we can put the add transactions. Then we can optimize the lineup and post again.
    }

    const addCandidates: IPlayer[] = allAddCandidates[team.team_key];
    if (addCandidates?.length > 0) {
      lo.addCandidates = addCandidates;

      if (team.allow_adding) {
        lo.generateAddPlayerTransactions();
      }
      if (team.allow_add_drops) {
        // TODO: Can add add/dropping here as well
        // lo.generateAddDropPlayerTransactions();
      }
    }

    // TODO: This needs to be rearranged.
    const playerTransactions: PlayerTransaction[] = lo.playerTransactions;
    if (playerTransactions.length > 0) {
      result.push(playerTransactions);
    }
  }

  return result;
}

async function refetchAndPatchTeams(
  todaysPlayerTransactions: PlayerTransaction[][],
  uid: string,
  originalTeams: ITeamOptimizer[]
): Promise<ITeamOptimizer[]> {
  const result = structuredClone(originalTeams);

  const updatedTeamKeys = getTeamKeysFromTransactions(todaysPlayerTransactions);
  const updatedTeams = await fetchRostersFromYahoo(updatedTeamKeys, uid);

  updatedTeams.forEach((updatedTeam) => {
    const originalIdx = result.findIndex(
      (originalTeam: ITeamOptimizer) =>
        originalTeam.team_key === updatedTeam.team_key
    );
    result[originalIdx] = updatedTeam;
  });

  return result;
}

async function postAllTransactions(
  playerTransactions: PlayerTransaction[][],
  uid: string
): Promise<void> {
  const allTransactions = playerTransactions.flat();
  // if there is a failure calling the Yahoo API, it will be swallowed here, and we will simply log it
  for (const transaction of allTransactions) {
    try {
      await postRosterAddDropTransaction(transaction, uid);
    } catch (err: any) {
      logger.error(
        `Error in postAllTransactions() for User: ${uid}: ${err.message}`
      );
      logger.error("Transaction: ", transaction);
      throw err;
    }
  }

  // TODO: Send notification email after every successful set of transactions
  // TODO: When to send email for confirmation, if we have that setting on?
  // TODO: Send the email with debugging information - such as player added name, ownership score. Who moved to IR. Any unfilled or critical positions on team.

  // TODO: This is the code to use if we want to use Promise.allSettled in parallel
  // const allTransactionsPromises = playerTransactions
  //   .flat()
  //   .map((transaction) => postRosterAddDropTransaction(transaction, uid));
  // const results = await Promise.allSettled(allTransactionsPromises);
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

function getTeamKeysFromTransactions(
  transactions: PlayerTransaction[][]
): string[] {
  const uniqueKeys = new Set<string>();
  for (const team of transactions) {
    for (const playerTransaction of team) {
      uniqueKeys.add(playerTransaction.teamKey);
    }
  }
  return Array.from(uniqueKeys);
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPacificTimeDateString(tomorrow);
}
