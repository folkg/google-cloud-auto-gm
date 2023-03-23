import { LineupChanges } from "../interfaces/LineupChanges";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postLineupChanges } from "../../common/services/yahooAPI/yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

import { initStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";
import { LineupOptimizer } from "../classes/LineupOptimizer";
import { PlayerTransaction } from "../interfaces/PlayerTransaction";
import { Team } from "../interfaces/Team";
import { datePSTString } from "../../common/services/utilities.service";

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

  // TODO: for player adds, we need to physically move those players to IL.  We can't just add them to the roster.
  // This means we need to make lineupChanges as well as playerTransactions. Shit...
  // Maybe we first do drops if dropping. Then call another function to move players to IL. Then call another function to add players to the roster.

  const rosters = await fetchRostersFromYahoo(teams, uid);

  const teamsWithEditKeyToday = getTeamsWithEditKeyToday(rosters);
  const todaysPlayerTransactions = await getPlayerTransactions(
    teamsWithEditKeyToday
  );
  if (todaysPlayerTransactions.length > 0) {
    // post all transactions in a promiseall?
    // worth trying to post many transactions in one API call?
  }

  const allLineupChanges = await getLineupChanges(rosters);
  if (allLineupChanges.length > 0) {
    await postLineupChanges(allLineupChanges, uid);
  }

  const teamsWithEditKeyFuture = getTeamsWithEditKeyFuture(rosters);
  // TODO: Get new rosters for future days. For now, just use todays rosters and hope for the best.
  const futurePlayerTransactions = await getPlayerTransactions(
    teamsWithEditKeyFuture
  );
  if (futurePlayerTransactions.length > 0) {
    // post all transactions in a promiseall?
    // worth trying to post many transactions in one API call?
  }

  return Promise.resolve();
}

async function getPlayerTransactions(
  rosters: Team[]
): Promise<PlayerTransaction[][]> {
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

function getTeamsWithEditKeyToday(rosters: Team[]): Team[] {
  return rosters.filter(
    (roster) =>
      (roster.allow_adding || roster.allow_dropping) &&
      (roster.game_code === "nfl" || roster.weekly_deadline === "intraday")
  );
}

function getTeamsWithEditKeyFuture(rosters: Team[]): Team[] {
  return rosters.filter(
    (roster) =>
      (roster.allow_adding || roster.allow_dropping) &&
      roster.game_code !== "nfl" &&
      roster.weekly_deadline !== "intraday"
  );
}
