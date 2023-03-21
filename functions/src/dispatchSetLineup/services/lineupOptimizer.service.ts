import { RosterModification } from "../interfaces/RosterModification";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterModifications } from "../../common/services/yahooAPI/yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

import { initStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";
import { LineupOptimizer } from "../classes/LineupOptimizer";

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

  const rosterModifications: RosterModification[] =
    await getRosterModifications(teams, uid);

  await postRosterModifications(rosterModifications, uid);

  return Promise.resolve();
}

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
): Promise<RosterModification[]> {
  const rosters = await fetchRostersFromYahoo(teams, uid);
  const rosterModifications: RosterModification[] = [];

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
    if (rosterChange) {
      rosterModifications.push(rosterChange.rosterModification);
    }
  }
  return rosterModifications;
}
