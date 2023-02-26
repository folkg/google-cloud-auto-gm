import {
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { db } from "./firestore.service";
import { getChild } from "./utilities.service";
import { getStartingGoalies } from "./yahooAPI.service";

/**
 * The NHL starting goalies for the current day as a global variable
 *
 * @type {Promise<string[]>}
 */
export let NHL_STARTING_GOALIES: string[];

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
  console.log(
    "Loading starting goalies from Yahoo. Logging this to see if it's called more than once."
  );
  const startingGoalies: string[] = [];
  const results = await getStartingGoalies(uid, leagueKey);
  if (results) {
    for (const goaliesJSON of results) {
      const goalies = goaliesJSON.fantasy_content.league[1].players;
      for (const key in goalies) {
        if (key !== "count") {
          startingGoalies.push(getChild(goalies[key].player[0], "player_key"));
        }
      }
    }
  }
  return startingGoalies;
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
      .set({ startingGoalies, timestamp: Date.now() });
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
      const timestamp = startingGoaliesSnapshot.data()?.timestamp;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (timestamp && timestamp >= today.getTime()) {
        return startingGoaliesSnapshot.data()?.startingGoalies;
      }
    }
    // if the starting goalies were not updated today,
    // or don't exist in firebase, fetch them from Yahoo API
    try {
      await fetchStartingGoaliesYahoo();
      return getStartingGoaliesFromFirestore();
    } catch (error: Error | any) {
      console.error(error);
    }
  } catch (error: Error | any) {
    console.error("Error getting starting goalies from firestore: " + error);
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
  if (!NHL_STARTING_GOALIES) {
    NHL_STARTING_GOALIES = await getStartingGoaliesFromFirestore();
    console.log(
      "Initialized NHL starting goalies global array from Firestore. Logging this to see how many times it is called."
    );
  }
}
