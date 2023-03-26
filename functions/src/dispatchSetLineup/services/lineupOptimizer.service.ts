import { HttpsError } from "firebase-functions/v2/https";
import {
  datePSTString,
  is2DArrayEmpty,
} from "../../common/services/utilities.service";
import {
  postRosterAddDropTransaction,
  putLineupChanges,
} from "../../common/services/yahooAPI/yahooAPI.service";
import { initStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";
import { LineupOptimizer } from "../classes/LineupOptimizer";
import { LineupChanges } from "../interfaces/LineupChanges";
import { PlayerTransaction } from "../interfaces/PlayerTransaction";
import { ITeam } from "../interfaces/ITeam";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";

/**
 * Will optimize the starting lineup for a specific users teams
 *
 * @export
 * @async
 * @param {(string)} uid - The user id
 * @param {(string[])} teamKeys - The team ids
 * @return {unknown}
 */
export async function setUsersLineup(
  uid: string,
  teamKeys: string[]
): Promise<void> {
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }
  if (!teamKeys) {
    throw new HttpsError(
      "invalid-argument",
      "You must provide a list of teams to optimize"
    );
  }

  await initStartingGoalies();

  // TODO: Calling a weekly league on Sunday (day before) should be calling tomorrow's rosters.
  // We need to make a special call for this though, since it won't be in the list of teams.
  let usersTeams = await fetchRostersFromYahoo(teamKeys, uid);
  usersTeams = await processTransactionsForSameDayChanges(usersTeams, uid);
  usersTeams = await processTodaysLineupChanges(usersTeams, uid);
  await processTransactionsForNextDayChanges(usersTeams, uid);

  return Promise.resolve();
}

async function processTodaysLineupChanges(
  teams: ITeam[],
  uid: string
): Promise<ITeam[]> {
  const result: ITeam[] = [];

  const allLineupChanges: LineupChanges[] = [];
  for (const team of teams) {
    const lo = new LineupOptimizer(team);
    const lineupChanges = lo.optimizeStartingLineup();
    result.push(lo.getCurrentTeamState());
    lo.isSuccessfullyOptimized(); // will log any errors, we could remove this later once we're confident in the optimizer
    if (lineupChanges) {
      allLineupChanges.push(lineupChanges);
    }
  }

  if (allLineupChanges.length > 0) {
    // if there is a failure calling the Yahoo API, an error will be thrown, and we will let it propagate up
    try {
      await putLineupChanges(allLineupChanges, uid);
    } catch (err: Error | any) {
      console.error(err.message);
      console.error(
        "Lineup changes object: " + JSON.stringify(allLineupChanges)
      );
      console.error("Teams object: " + JSON.stringify(teams));
      throw err;
    }
  }

  return result;
}

async function processTransactionsForSameDayChanges(
  originalTeams: ITeam[],
  uid: string
): Promise<ITeam[]> {
  let result: ITeam[] = originalTeams;

  const teams = getTeamsWithSameDayTransactions(originalTeams);
  const transactions = getPlayerTransactions(teams);
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (err) {
      console.error("Error in processTransactionsForSameDayChanges()");
      console.error(`Teams object: ${JSON.stringify(originalTeams)}`);
    }
    // returns a new deep copy of the teams with the updated player transactions
    result = await refetchAndPatchTeams(transactions, uid, originalTeams);
  }

  return result;
}

async function processTransactionsForNextDayChanges(
  originalTeams: ITeam[],
  uid: string
): Promise<void> {
  // check if there are any transactions required for teams with next day changes
  // this pre-check is to save on Yahoo API calls
  const teams = getTeamsForNextDayTransactions(originalTeams);
  const potentialTransactions = getPlayerTransactions(teams);

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

  const transactions = getPlayerTransactions(tomorrowsTeams);
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (err) {
      console.error("Error in processTransactionsForNextDayChanges()");
      console.error(`Teams object: ${JSON.stringify(originalTeams)}`);
    }
  }
}

function getPlayerTransactions(teams: ITeam[]): PlayerTransaction[][] {
  // console.log(
  //   "finding transactions for user: " + uid + "teams: " + JSON.stringify(teams)
  // );
  const result: PlayerTransaction[][] = [];

  for (const team of teams) {
    const lo = new LineupOptimizer(team);
    const playerTransactions = lo.findDropPlayerTransactions();

    if (playerTransactions) {
      result.push(playerTransactions);
    }
  }

  return result;
}

async function refetchAndPatchTeams(
  todaysPlayerTransactions: PlayerTransaction[][],
  uid: string,
  originalTeams: ITeam[]
): Promise<ITeam[]> {
  const result = structuredClone(originalTeams);

  const updatedTeamKeys = getTeamKeysFromTransactions(todaysPlayerTransactions);
  const updatedTeams = await fetchRostersFromYahoo(updatedTeamKeys, uid);

  updatedTeams.forEach((updatedTeam) => {
    const originalIdx = result.findIndex(
      (originalTeam: ITeam) => originalTeam.team_key === updatedTeam.team_key
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
      console.error(
        `Error in postAllTransactions() for User: ${uid}: ${err.message}`
      );
      console.error(`Transaction: ${JSON.stringify(transaction)}`);
      throw err;
    }
  }

  // TODO: This is the code to use if we want to use Promise.allSettled in parallel
  // const allTransactionsPromises = playerTransactions
  //   .flat()
  //   .map((transaction) => postRosterAddDropTransaction(transaction, uid));
  // const results = await Promise.allSettled(allTransactionsPromises);
}

function getTeamsWithSameDayTransactions(teams: ITeam[]): ITeam[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      team.edit_key === team.coverage_period
  );
}

function getTeamsForNextDayTransactions(teams: ITeam[]): ITeam[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
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
  return datePSTString(tomorrow);
}
