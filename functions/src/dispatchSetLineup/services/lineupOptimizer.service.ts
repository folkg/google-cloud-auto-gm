import { RosterModification } from "../interfaces/RosterModification";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterModifications } from "../../common/services/yahooAPI/yahooAPI.service";
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

  // initialize starting goalies global array
  await initStartingGoalies();

  const { rosterModifications } = await getRosterModifications(teams, uid);

  // TODO: getRosterModifications should return a PlayerTransaction object
  // TODO: if teams have playerTransactions and are intraday or NFL, post them, wait, redo the optimization, then post all rosterModifications together.
  await postRosterModifications(rosterModifications, uid);

  return Promise.resolve();
}

type RosterChange = {
  rosterModifications: RosterModification[];
  playerTransactions: PlayerTransaction[][];
};

/**
 * Will get the required roster modifications for a given user
 *
 * @async
 * @param {string[]} teams - The teams to optimize
 * @param {string} uid - The user id
 * @return {Promise<RosterModification[]>} - The roster modifications to make
 */
async function getRosterModifications(
  teams: string[],
  uid: string
): Promise<RosterChange> {
  const rosters = await fetchRostersFromYahoo(teams, uid);

  const result: RosterChange = {
    rosterModifications: [],
    playerTransactions: [],
  };
  // console.log(
  //   "optimizing for user: " + uid + "teams: " + JSON.stringify(teams)
  // );

  for (const roster of rosters) {
    const lo = new LineupOptimizer(roster);
    const rosterChange = lo.optimizeStartingLineup();
    lo.isSuccessfullyOptimized(); // will log any errors
    // const rm = await optimizeStartingLineup2(roster);
    // console.info(
    //   "rm for team " + roster.team_key + " is " + JSON.stringify(rm)
    // );
    // TODO: Need to return the playerTransaction object as well eventually
    if (rosterChange) {
      result.rosterModifications.push(rosterChange.rosterModification);
      result.playerTransactions.push(rosterChange.playerTransactions);
    }
  }
  return result;
}
