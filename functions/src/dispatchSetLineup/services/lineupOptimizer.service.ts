import { RosterModification } from "../interfaces/RosterModification";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import {
  postRosterAddDropTransaction,
  postRosterModifications,
} from "../../common/services/yahooAPI/yahooAPI.service";
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

  const { allRosterModifications, allPlayerTransactions } =
    await getRosterChanges(teams, uid);

  //TODO: refactor this, it's ugly!
  const teamsToReoptimize: string[] = [];
  for (const teamTransactions of allPlayerTransactions) {
    if (teamTransactions.length == 0) break;
    let reoptimizeTeam = false;
    // promiseall transactions?
    for (const transaction of teamTransactions) {
      try {
        await postRosterAddDropTransaction(transaction, uid);
        if (transaction.isImmediateTransaction) reoptimizeTeam = true;
      } catch (error) {
        console.error(error);
      }
    }
    if (reoptimizeTeam) {
      teamsToReoptimize.push(teamTransactions[0].teamKey);
    }
  }

  if (teamsToReoptimize.length > 0) {
    const { allRosterModifications: updatedRosterModifications } =
      await getRosterChanges(teamsToReoptimize, uid);
    for (const urm of updatedRosterModifications) {
      const index = allRosterModifications.findIndex(
        (r) => r.teamKey === urm.teamKey
      );
      if (index > -1) {
        allRosterModifications[index] = urm;
      }
    }
  }

  await postRosterModifications(allRosterModifications, uid);

  return Promise.resolve();
}

type RosterChange = {
  allRosterModifications: RosterModification[];
  allPlayerTransactions: PlayerTransaction[][];
};

/**
 * Will get the required roster modifications for a given user
 *
 * @async
 * @param {string[]} teams - The teams to optimize
 * @param {string} uid - The user id
 * @return {Promise<RosterModification[]>} - The roster modifications to make
 */
async function getRosterChanges(
  teams: string[],
  uid: string
): Promise<RosterChange> {
  const rosters = await fetchRostersFromYahoo(teams, uid);

  const result: RosterChange = {
    allRosterModifications: [],
    allPlayerTransactions: [],
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
      result.allRosterModifications.push(rosterChange.rosterModification);
      result.allPlayerTransactions.push(rosterChange.playerTransactions);
    }
  }
  return result;
}
