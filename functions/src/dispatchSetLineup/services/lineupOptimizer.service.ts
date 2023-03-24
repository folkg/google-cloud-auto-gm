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

  // TODO: Rosters with same day changes other than continous waiver_rule could drop player today, but add players for tomorrow. Tricky/messy edge case...
  // could split up the adding and the dropping into two different functions, but that would require a lot of mess. Think about it.
  // In all likelyhood, this will be okay, since the player will likely be dropped at 155am, and then roster will be re-optimized later in the day.

  rosters = await postTransactionsForSameDayChanges(rosters, uid);

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
  if (transactions.length > 0) {
    await postAllTransactions(transactions, uid);
    result = await refetchAndPatchRosters(transactions, uid, originalRosters);
  }

  return result;
}

async function postTransactionsForNextDayChanges(
  originalRosters: Team[],
  uid: string
): Promise<void> {
  const teamKeys = getTeamsForNextDayTransactions(originalRosters).map(
    (roster) => roster.team_key
  );
  const rosters = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );
  const transactions = getPlayerTransactions(rosters);
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
  originalRosters: Team[]
): Promise<Team[]> {
  const result = JSON.parse(JSON.stringify(originalRosters));

  const updatedTeamKeys = todaysPlayerTransactions
    .reduce((acc, val) => acc.concat(val), [])
    .map((transaction) => transaction.teamKey);
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
