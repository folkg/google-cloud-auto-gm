import { LineupChanges } from "../interfaces/LineupChanges";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postLineupChanges } from "../../common/services/yahooAPI/yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

import { initStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";
import { LineupOptimizer } from "../classes/LineupOptimizer";
import { PlayerTransaction } from "../interfaces/PlayerTransaction";

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

  const allPlayerTransactions = await getPlayerTransactions(teams, uid);
  if (allPlayerTransactions.length > 0) {
    // post all transactions in a promiseall?
  }

  const allLineupChanges = await getLineupChanges(teams, uid);
  if (allLineupChanges.length > 0) {
    await postLineupChanges(allLineupChanges, uid);
  }

  return Promise.resolve();
}

async function getPlayerTransactions(
  teams: string[],
  uid: string
): Promise<PlayerTransaction[][]> {
  const rosters = await fetchRostersFromYahoo(teams, uid);

  const result: PlayerTransaction[][] = [];
  // console.log(
  //   "finding transactions for user: " + uid + "teams: " + JSON.stringify(teams)
  // );

  for (const roster of rosters) {
    if (!roster.allow_adding && !roster.allow_dropping) continue;

    const lo = new LineupOptimizer(roster);
    const rosterTransactions = lo.findPlayerTransactions();
    if (rosterTransactions) {
      result.push(rosterTransactions);
    }
  }
  return result;
}

async function getLineupChanges(
  teams: string[],
  uid: string
): Promise<LineupChanges[]> {
  const rosters = await fetchRostersFromYahoo(teams, uid);

  const result: LineupChanges[] = [];
  // console.log(
  //   "optimizing for user: " + uid + "teams: " + JSON.stringify(teams)
  // );

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
