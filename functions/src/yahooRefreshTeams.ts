import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { CallableContext } from "firebase-functions/lib/common/providers/https";

import { Team } from "./interfaces/team";
import { httpGet } from "./services/yahooHttp.service";

exports.refreshTeams = functions.https.onCall(
  async (data, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to get an access token"
      );
    }
    const teams: Team[] = await fetchTeamsFromYahoo(uid);

    const db = admin.firestore();
    const batch = db.batch();
    teams.forEach((team) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = team;
      const docId = String(team.team_key);
      // remove the team_key from the data since it will be the doc id
      // and add the uid as a field
      delete data.team_key;
      data.uid = uid;

      const docRef = db.collection("teams").doc(docId);
      batch.set(docRef, data);
    });
    const results = await batch.commit();
    // TODO: Add a more meaningful return value? Or does it matter?
    return results;
  }
);

/**
 * Create an array of Team objects for the calling user's Yahoo teams
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<Team[]>} An array of Team objects from Yahoo
 */
async function fetchTeamsFromYahoo(uid: string): Promise<Team[]> {
  const teams: Team[] = [];
  const standings = await getAllStandings(uid);
  const games = standings.fantasy_content.users[0].user[1].games;
  // console.log(games); //use this to debug the JSON object and see all data
  // Loop through each "game" (nfl, nhl, nba, mlb)
  for (const key in games) {
    if (key !== "count") {
      const game = games[key].game[0];
      const leagues = games[key].game[1].leagues;
      // Loop through each league within the game
      // TODO: Convert date to a timestamp
      for (const key in leagues) {
        if (key !== "count") {
          const allTeams = leagues[key].league[1].standings[0].teams;
          const usersTeam = getUsersTeam(allTeams);
          const data: Team = {
            game_code: game.code,
            team_key: usersTeam.team[0][0].team_key,
            scoring_type: leagues[key].league[0].scoring_type,
            start_date: Date.parse(leagues[key].league[0].start_date),
            end_date: Date.parse(leagues[key].league[0].end_date),
            edit_key: leagues[key].league[0].edit_key,
            is_approved: true, // in future if we add payment default to false
            is_setting_lineups: false,
            last_updated: -1,
          };
          teams.push(data);
        }
      }
    }
  }
  console.log("Fetched teams from Yahoo API:");
  console.log(teams);
  return teams;
}

/**
 * Get all the standings for all the leagues for all the games from Yahoo
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<any>} The Yahoo JSON object containing league standings
 */
async function getAllStandings(uid: string): Promise<any> {
  try {
    return await httpGet(
      "users;use_login=1/games;game_keys=nfl,nhl,nba,mlb/" +
        "leagues/standings?format=json",
      uid
    );
  } catch (error) {
    console.log("Error fetching teams from Yahoo API:");
    console.log(error);
    throw new functions.https.HttpsError(
      "internal",
      "Communication with Yahoo failed: " + error
    );
  }
}

/**
 * Find the team managed by the current login
 * @param {*} allTeams - an object containing all teams in the league
 * @return {*} an object containing just the user's team
 */
function getUsersTeam(allTeams: any): any {
  for (const key in allTeams) {
    if (key !== "count" && allTeams[key].team[0][3].is_owned_by_current_login) {
      return allTeams[key];
    }
  }
}
