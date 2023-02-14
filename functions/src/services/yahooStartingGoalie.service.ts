import * as admin from "firebase-admin";
import { leaguesToSetLineupsFor } from "./schedulingService";
import { getChild } from "./utilities.service";
import { getStartingGoalies } from "./yahooAPI.service";
const db = admin.firestore();

/**
 * The NHL starting goalies for the current day as a global variable
 *
 * @type {Promise<string[]>}
 */
export const NHL_STARTING_GOALIES: Promise<string[]> =
  fetchStartingGoaliesYahoo();

/**
 * Fetches the starting goalies from Yahoo API
 *
 * @export
 * @async
 * @return {Promise<void>} void
 */
async function fetchStartingGoaliesYahoo(): Promise<string[]> {
  // get a team from firestore where weekly_deadline='intraday' and game='nhl'
  // we will use their access token to get the starting goalies
  console.log(
    "fetchStartingGoaliesYahoo. Logging this to see how many times it is called."
  );

  const leagues: string[] = await leaguesToSetLineupsFor();
  // we won't waste resources getting starting goalies if we aren't
  // setting lineups for the NHL currently

  // TODO: Uncomment this!
  console.log("Leagues: " + leagues);
  // if (!leagues.includes("nhl")) return [];

  const teamsRef = db.collectionGroup("teams");
  const teamsSnapshot = await teamsRef
    .where("game_code", "==", "nhl")
    .where("end_date", ">=", Date.now())
    .where("weekly_deadline", "==", "intraday")
    .get();
  if (teamsSnapshot.empty) {
    console.log("Not able to get league key from firestore");
    return [];
  }
  const teamKey = teamsSnapshot.docs[0].id;
  const leagueKey = teamKey.split(".t")[0];
  const uid = teamsSnapshot.docs[0].data().uid;
  try {
    const startingGoalies: string[] = [];
    const results = await getStartingGoalies(uid, leagueKey);
    if (!results) return [];
    for (const goaliesJSON of results) {
      const goalies = goaliesJSON.fantasy_content.league[1].players;
      for (const key in goalies) {
        if (key !== "count") {
          startingGoalies.push(getChild(goalies[key].player[0], "player_key"));
        }
      }
    }
    // console.log("Starting goalies count: " + startingGoalies.length);
    // console.log("Starting goalies: " + JSON.stringify(startingGoalies));
    return startingGoalies;
  } catch (error: Error | any) {
    console.log("Error getting starting goalies from Yahoo API: " + error);
    return [];
  }
}
