import {
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { leaguesToSetLineupsFor } from "../../../scheduleSetLineup/services/schedulingService";
import { db } from "../firebase/firestore.service";
import { datePSTString, getChild } from "../utilities.service";
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

  const teamsSnapshot: QuerySnapshot<DocumentData> =
    await getIntradayNHLTeams();
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

  await storeStartingGoaliesToFirestore(startingGoalies);
}

/**
 * Gets a team from firestore where weekly_deadline='intraday' and game='nhl'
 *
 * @async
 * @return {Promise<QuerySnapshot<DocumentData>>} the team
 */
async function getIntradayNHLTeams(): Promise<QuerySnapshot<DocumentData>> {
  const teamsRef = db.collectionGroup("teams");
  try {
    const teamsSnapshot = await teamsRef
      .where("game_code", "==", "nhl")
      .where("end_date", ">=", Date.now())
      .where("weekly_deadline", "==", "intraday")
      .get();
    return teamsSnapshot;
  } catch (error: Error | any) {
    throw new Error(
      "Error fetching Intraday NHL teams from firestore: " + error.message
    );
  }
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
 * Stores the starting goalies to firestore
 *
 * @async
 * @param {string[]} startingGoalies - the starting goalies
 * @return {Promise<void>}
 */
async function storeStartingGoaliesToFirestore(
  startingGoalies: string[]
): Promise<void> {
  const startingGoaliesRef = db.collection("startingGoalies");
  try {
    await startingGoaliesRef
      .doc("nhl")
      .set({ startingGoalies, date: datePSTString(new Date()) });
  } catch (error: Error | any) {
    throw new Error(
      "Error storing starting goalies to firestore: " + error.message
    );
  }
}

/**
 * Gets today's starting goalies from firestore
 *
 * @async
 * @return {Promise<string[]>} the starting goalies
 */
async function getStartingGoaliesFromFirestore(): Promise<string[]> {
  const startingGoaliesRef = db.collection("startingGoalies");

  try {
    const startingGoaliesSnapshot: DocumentSnapshot<DocumentData> =
      await startingGoaliesRef.doc("nhl").get();

    if (startingGoaliesSnapshot.exists) {
      // check if the starting goalies were updated today
      const date: string = startingGoaliesSnapshot.data()?.date;
      const today = datePSTString(new Date());

      if (date === today) {
        return startingGoaliesSnapshot.data()?.startingGoalies;
      }
    }
    // if the starting goalies were not updated today,
    // or don't exist in firebase, fetch them from Yahoo API
    try {
      await fetchStartingGoaliesYahoo();
      return getStartingGoaliesFromFirestore();
    } catch (error: Error | any) {
      logger.error(error);
    }
  } catch (error: Error | any) {
    logger.error("Error getting starting goalies from firestore: " + error);
  }

  // return an empty array if there was an error
  // we can still proceed with the rest of the program
  return [];
}

/**
 * Initializes the starting goalies array
 *
 * @export
 * @async
 * @return {Promise<void>}
 */
export async function initStartingGoalies(): Promise<void> {
  if (!(await leaguesToSetLineupsFor()).includes("nhl")) {
    return;
  }
  // TODO: Ensure there are NHL games being played in next hour before fetching starting goalies
  if (!NHL_STARTING_GOALIES) {
    NHL_STARTING_GOALIES = await getStartingGoaliesFromFirestore();
    logger.log(
      "Initialized NHL starting goalies global array from Firestore. Logging this to see how many times it is called."
    );
  } else {
    logger.log(
      "NHL starting goalies global array already initialized within this instance, NOT fetching from Firestore."
    );
  }
}
