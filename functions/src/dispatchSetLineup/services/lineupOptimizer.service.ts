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
import { Team } from "../interfaces/Team";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";

/**
 * Will optimize the starting lineup for a specific users teams
 *
 * @export
 * @async
 * @param {(string)} uid - The user id
 * @param {(string[])} teams - The team ids
 * @return {unknown}
 */
export async function setUsersLineup(
  uid: string,
  teams: string[]
): Promise<void> {
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }
  if (!teams) {
    throw new HttpsError(
      "invalid-argument",
      "You must provide a list of teams to optimize"
    );
  }

  await initStartingGoalies();

  let rosters = await fetchRostersFromYahoo(teams, uid);

  rosters = await postTransactionsForSameDayChanges(rosters, uid);

  //TODO: Should we get the rosters again after the lineup changes are made?
  // Move this to its own function
  const allLineupChanges = await getLineupChanges(rosters);
  if (allLineupChanges.length > 0) {
    await putLineupChanges(allLineupChanges, uid);
  }

  await postTransactionsForNextDayChanges(rosters, uid);

  return Promise.resolve();
}

async function postTransactionsForSameDayChanges(
  originalRosters: Team[],
  uid: string
): Promise<Team[]> {
  let result: Team[] = originalRosters;

  const rosters = getTeamsWithSameDayTransactions(originalRosters);
  const transactions = getPlayerTransactions(rosters);
  if (!is2DArrayEmpty(transactions)) {
    await postAllTransactions(transactions, uid);
    result = await refetchAndPatchRosters(transactions, uid, originalRosters);
  }

  return result;
}

async function postTransactionsForNextDayChanges(
  originalRosters: Team[],
  uid: string
): Promise<void> {
  // check if there are any transactions required for teams with next day changes
  // this pre-check is to save on Yahoo API calls
  const rosters = getTeamsForNextDayTransactions(originalRosters);
  const potentialTransactions = getPlayerTransactions(rosters);
  if (is2DArrayEmpty(potentialTransactions)) {
    return;
  }

  // if there are transactions required, get tomorrow's rosters and perform the transactions
  const uniqueTeamKeys = getUniqueTeamKeys(potentialTransactions);
  const tomorrowsRosters = await fetchRostersFromYahoo(
    uniqueTeamKeys,
    uid,
    tomorrowsDateAsString()
  );
  const transactions = getPlayerTransactions(tomorrowsRosters);
  if (!is2DArrayEmpty(transactions)) {
    await postAllTransactions(transactions, uid);
  }
}

function getPlayerTransactions(rosters: Team[]): PlayerTransaction[][] {
  // console.log(
  //   "finding transactions for user: " + uid + "teams: " + JSON.stringify(teams)
  // );
  const result: PlayerTransaction[][] = [];

  for (const roster of rosters) {
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();
    if (playerTransactions) {
      result.push(playerTransactions);
    }
  }

  return result;
}

async function getLineupChanges(rosters: Team[]): Promise<LineupChanges[]> {
  // console.log(
  //   "optimizing for user: " + uid + "teams: " + JSON.stringify(teams)
  // );
  const result: LineupChanges[] = [];

  for (const roster of rosters) {
    const lo = new LineupOptimizer(roster);
    const lineupChanges = lo.optimizeStartingLineup();
    lo.isSuccessfullyOptimized(); // will log any errors
    if (lineupChanges) {
      result.push(lineupChanges);
    }
  }

  //TODO: Should we get the rosters again after the lineup changes are made?

  return result;
}

async function refetchAndPatchRosters(
  todaysPlayerTransactions: PlayerTransaction[][],
  uid: string,
  originalRosters: Team[]
): Promise<Team[]> {
  console.log("refetching and patching rosters");

  const result = JSON.parse(JSON.stringify(originalRosters));

  const updatedTeamKeys = getUniqueTeamKeys(todaysPlayerTransactions);
  const updatedRosters = await fetchRostersFromYahoo(updatedTeamKeys, uid);

  updatedRosters.forEach((updatedRoster) => {
    const originalIdx = result.findIndex(
      (originalRoster: Team) =>
        originalRoster.team_key === updatedRoster.team_key
    );
    result[originalIdx] = updatedRoster;
  });

  return result;
}

async function postAllTransactions(
  playerTransactions: PlayerTransaction[][],
  uid: string
): Promise<void> {
  // TODO: Do we just want to post these sequentially instead? Might be easier on the Yahoo API
  const allTransactionsPromises = playerTransactions
    .flat()
    .map((transaction) => postRosterAddDropTransaction(transaction, uid));
  const results = await Promise.allSettled(allTransactionsPromises);

  if (results.some((result) => result.status === "rejected")) {
    console.error(
      "Error posting transactions: " + JSON.stringify(results, null, 2)
    );
  }
}

function getTeamsWithSameDayTransactions(rosters: Team[]): Team[] {
  return rosters.filter(
    (roster) =>
      (roster.allow_adding || roster.allow_dropping) &&
      roster.edit_key === roster.coverage_period
  );
}

function getTeamsForNextDayTransactions(rosters: Team[]): Team[] {
  return rosters.filter(
    (roster) =>
      (roster.allow_adding || roster.allow_dropping) &&
      roster.edit_key !== roster.coverage_period
  );
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return datePSTString(tomorrow);
}

function getUniqueTeamKeys(transactions: PlayerTransaction[][]): string[] {
  const uniqueKeys = new Set<string>();
  for (const team of transactions) {
    for (const playerTransaction of team) {
      uniqueKeys.add(playerTransaction.teamKey);
    }
  }
  return Array.from(uniqueKeys);
}
