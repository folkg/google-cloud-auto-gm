import { HttpsError } from "firebase-functions/v2/https";
import { datePSTString } from "../../common/services/utilities.service";
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

  const allLineupChanges = await getLineupChanges(rosters);
  if (allLineupChanges.length > 0) {
    await putLineupChanges(allLineupChanges, uid);
  }

  await postTransactionsForNextDayChanges(rosters, uid);

  return Promise.resolve();
}

async function postTransactionsForSameDayChanges(rosters: Team[], uid: string) {
  let result: Team[] = rosters;

  const teams = getTeamsWithSameDayTransactions(rosters);
  const transactions = getPlayerTransactions(teams);
  if (transactions.length > 0) {
    await postAllTransactions(transactions, uid);
    result = await refetchAndPatchRosters(transactions, uid, rosters);
  }

  return result;
}

async function postTransactionsForNextDayChanges(rosters: Team[], uid: string) {
  const teamKeys = getTeamsForNextDayTransactions(rosters).map(
    (roster) => roster.team_key
  );
  const teams = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );
  const transactions = getPlayerTransactions(teams);
  if (transactions.length > 0) {
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
  return result;
}

async function refetchAndPatchRosters(
  todaysPlayerTransactions: PlayerTransaction[][],
  uid: string,
  rosters: Team[]
): Promise<Team[]> {
  const result = JSON.parse(JSON.stringify(rosters));
  const updatedTeamKeys = todaysPlayerTransactions
    .reduce((acc, val) => acc.concat(val), [])
    .map((transaction) => transaction.teamKey);
  const updatedRosters = await fetchRostersFromYahoo(updatedTeamKeys, uid);

  updatedRosters.forEach((updatedRoster) => {
    const originalIdx = result.findIndex(
      (roster: Team) => roster.team_key === updatedRoster.team_key
    );
    result[originalIdx] = updatedRoster;
  });
  return result;
}

async function postAllTransactions(
  playerTransactions: PlayerTransaction[][],
  uid: string
): Promise<void> {
  const allTransactionsPromises = playerTransactions
    .reduce((acc, val) => acc.concat(val), [])
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
      roster.edit_key === roster.coverage_period &&
      roster.waiver_rule !== "continuous"
  );
}

function getTeamsForNextDayTransactions(rosters: Team[]): Team[] {
  return rosters.filter(
    (roster) =>
      (roster.allow_adding || roster.allow_dropping) &&
      (roster.edit_key !== roster.coverage_period ||
        roster.waiver_rule === "continuous")
  );
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return datePSTString(tomorrow);
}
