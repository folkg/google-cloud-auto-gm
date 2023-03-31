import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  getIntradayTeams,
  getStartingPlayersFromFirestore,
  storeStartingPlayersInFirestore,
} from "../firebase/firestore.service";
import { getChild } from "../utilities.service";
import { getStartingGoalies } from "./yahooAPI.service";

/**
 * The NHL starting goalies for the current day as a global variable
 *
 * @type {Promise<string[]>}
 */
let NHL_STARTING_GOALIES: string[];
export function getNHLStartingGoalies(): string[] {
  return NHL_STARTING_GOALIES;
}

/**
 * Fetches the starting goalies from Yahoo API
 *
 * @export
 * @async
 * @return {Promise<void>} void
 */
export async function fetchStartingGoaliesYahoo(): Promise<void> {
  // get a team from firestore where weekly_deadline='intraday' and game='nhl'
  // we will use their access token to get the starting goalies for all users

  const teamsSnapshot: QuerySnapshot<DocumentData> = await getIntradayTeams(
    "nhl"
  );
  if (teamsSnapshot.empty) {
    throw new Error(
      "No teams found with weekly_deadline='intraday' and game='nhl'"
    );
  }

  const teamKey = teamsSnapshot.docs[0].id;
  const leagueKey = teamKey.split(".t")[0];
  const uid = teamsSnapshot.docs[0].data().uid;
  const startingGoalies: string[] = await getStartingGoaliesFromYahoo(
    uid,
    leagueKey
  );

  NHL_STARTING_GOALIES = startingGoalies;

  await storeStartingPlayersInFirestore(startingGoalies, "nhl");
}

/**
 * Populates the starting goalies array
 *
 * @async
 * @param {string} uid - the user's uid
 * @param {string} leagueKey - the league key
 * @return {Promise<void>}
 */
async function getStartingGoaliesFromYahoo(
  uid: string,
  leagueKey: string
): Promise<string[]> {
  logger.log(
    "Loading starting goalies from Yahoo. Logging this to see if it's called more than once."
  );
  const result: string[] = [];

  const startingGoalies = await getStartingGoalies(uid, leagueKey);
  if (startingGoalies) {
    for (const goaliesJSON of startingGoalies) {
      const goalies = goaliesJSON.fantasy_content.league[1].players;
      for (const key in goalies) {
        if (key !== "count") {
          result.push(getChild(goalies[key].player[0], "player_key"));
        }
      }
    }
  }

  return result;
}

/**
 * Initializes the starting goalies array
 *
 * @export
 * @async
 * @return {Promise<void>}
 */
export async function initStartingGoalies(): Promise<void> {
  if (!NHL_STARTING_GOALIES) {
    NHL_STARTING_GOALIES = await getStartingPlayersFromFirestore("nhl");
    logger.log(
      "Initialized NHL starting goalies global array from Firestore. Logging this to see how many times it is called."
    );
  } else {
    logger.log(
      "NHL starting goalies global array already initialized within this instance, NOT fetching from Firestore."
    );
  }
}
