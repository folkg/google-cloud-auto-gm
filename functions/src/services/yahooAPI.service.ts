import * as admin from "firebase-admin";
import { httpGetAxios, httpPostAxios, httpPutAxios } from "./yahooHttp.service";
import { RosterModification } from "../interfaces/roster";
import {
  ReturnCredential,
  YahooCredential,
  YahooRefreshRequestBody,
} from "../interfaces/credential";
import { AxiosError } from "axios";
import { HttpsError } from "firebase-functions/v2/https";
import { Team } from "../interfaces/team";
const js2xmlparser = require("js2xmlparser");

/**
 * Load the access token from DB, or refresh from Yahoo if expired
 * @param {(string)} uid The firebase uid
 * @return {Promise<ReturnCredential>} The credential with token and expiry
 */
export async function loadYahooAccessToken(
  uid: string
): Promise<ReturnCredential> {
  const db = admin.firestore();

  // fetch the current token from the database
  const doc = await db.collection("users").doc(uid).get();
  const docData = doc.data();
  if (!doc.exists || !docData) {
    throw new HttpsError("not-found", "No access token found for user");
  }

  // return the current token if it is valid, or refresh the token if not
  let credential: ReturnCredential;
  if (docData.tokenExpirationTime <= Date.now()) {
    // console.log("Token has expired, refreshing token.");
    credential = await refreshYahooAccessToken(uid, docData.refreshToken);
  } else {
    // console.log("Token is still valid, returning current token.");
    credential = {
      accessToken: docData.accessToken,
      tokenExpirationTime: docData.tokenExpirationTime,
    };
  }
  return credential;
}

/**
 * Refresh the Yahoo access token for the given user
 * @param {string} uid The firebase uid
 * @param {string} refreshToken The refresh token
 * @return {Promise<ReturnCredential>} The new credential
 */
async function refreshYahooAccessToken(
  uid: string,
  refreshToken: string
): Promise<ReturnCredential> {
  const db = admin.firestore();
  let credential: ReturnCredential = {
    accessToken: "",
    tokenExpirationTime: -1,
  };

  const url = "https://api.login.yahoo.com/oauth2/get_token";
  const requestBody: YahooRefreshRequestBody = {
    client_id: process.env.YAHOO_CLIENT_ID as string,
    client_secret: process.env.YAHOO_CLIENT_SECRET as string,
    redirect_uri: process.env.YAHOO_REDIRECT_URI as string,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };
  const body = Object.keys(requestBody)
    .map(
      (key) =>
        encodeURIComponent(key) +
        "=" +
        encodeURIComponent(requestBody[key as keyof YahooRefreshRequestBody])
    )
    .join("&");

  let results: YahooCredential;
  try {
    const { data } = await httpPostAxios(url, body);
    results = data as YahooCredential;
    // Get the token info from the response and save it to the database
    const accessToken = results.access_token;
    const tokenExpirationTime = results.expires_in * 1000 + Date.now();
    const token = {
      accessToken: accessToken,
      refreshToken: results.refresh_token,
      tokenExpirationTime: tokenExpirationTime,
    };

    // set will add or overwrite the data
    await db.collection("users").doc(uid).update(token);

    // return the credential from the function (without the refresh token)
    credential = {
      accessToken: accessToken,
      tokenExpirationTime: tokenExpirationTime,
    };
  } catch (error: AxiosError | any) {
    console.log("Error fetching token from Yahoo API");
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
      throw new HttpsError(
        "internal",
        "Communication with Yahoo failed: " + error.response.data
      );
    }
  }
  return credential;
}

// TODO: Update this function to use a different API call so that we aren't
// getting all the standings, nor using the getUsersTeam function
/**
 * Create an array of Team objects for the calling user's Yahoo teams
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<Team[]>} An array of Team objects from Yahoo
 */
export async function fetchTeamsFromYahoo(uid: string): Promise<Team[]> {
  // TODO: Update with the getChild function from utilities, more fleixible
  // TODO: Change the API request so we don't need to fetch standings
  const teams: Team[] = [];
  const standings = await getAllStandings(uid);
  const gamesJSON = standings.fantasy_content.users[0].user[1].games;
  // console.log(games); //use this to debug the JSON object and see all data
  // Loop through each "game" (nfl, nhl, nba, mlb)
  for (const key in gamesJSON) {
    if (key !== "count") {
      const game = gamesJSON[key].game[0];
      const leagues = gamesJSON[key].game[1].leagues;
      // Loop through each league within the game
      for (const key in leagues) {
        if (key !== "count") {
          const allTeams = leagues[key].league[1].standings[0].teams;
          const usersTeam = getUsersTeam(allTeams);
          const teamObj: Team = {
            uid: uid,
            game_code: game.code,
            team_key: usersTeam.team[0][0].team_key,
            // scoring_type: leagues[key].league[0].scoring_type,
            start_date: Date.parse(leagues[key].league[0].start_date),
            end_date: Date.parse(leagues[key].league[0].end_date),
            weekly_deadline: leagues[key].league[0].weekly_deadline,
            edit_key: leagues[key].league[0].edit_key,
            is_approved: true, // in future if we add payment default to false
            is_setting_lineups: false,
            last_updated: -1,
          };
          teams.push(teamObj);
        }
      }
    }
  }
  console.log("Fetched teams from Yahoo API:");
  console.log(teams);
  return teams;
}

// TODO: Move to yahooAPI.service.ts
/**
 * Will get the JSON response from Yahoo for all teams matching the TeamIDs
 * This will be useful if we want to get for just individual teams
 *
 * @async
 * @param {string} teams - comma separated string of teamIDs, ie.
 * "414.l.240994.t.12, 414.l.358976.t.4, 419.l.14950.t.2,
 * 419.l.19947.t.6,419.l.28340.t.1,419.l.59985.t.12"
 * @param {string} uid - The firebase uid
 * @return {Promise<any>} The Yahoo JSON object containing the rosters
 */
export async function getRostersByTeamID(
  teams: string[],
  uid: string
): Promise<any> {
  const leagueKeysArray: string[] = [];
  teams.forEach((teamKey) => {
    const leagueKey = teamKey.split(".t")[0];
    if (!leagueKeysArray.includes(leagueKey)) {
      leagueKeysArray.push(leagueKey);
    }
  });
  const leagueKeys = leagueKeysArray.join(",");

  const url =
    "users;use_login=1/games;game_keys=nhl,nfl,nba,mlb" +
    "/leagues;league_keys=" +
    leagueKeys +
    ";out=settings/teams/roster" +
    "/players;out=percent_started,percent_owned,ranks,opponent," +
    "transactions,starting_status" +
    ";ranks=projected_next7days,projected_week" +
    ";percent_started.cut_types=diamond" +
    ";percent_owned.cut_types=diamond" +
    ";transaction.cut_types=diamond" +
    "?format=json";

  try {
    const { data } = await httpGetAxios(url, uid);
    return data;
  } catch (error: AxiosError | any) {
    console.log("Error fetching rosters from Yahoo API");
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
      throw new HttpsError(
        "internal",
        "Communication with Yahoo failed: " + error.response.data
      );
    }
  }
}

// TODO: Update this function to use a different API call so that we aren't
// getting all the standings, nor using the getUsersTeam function
/**
 * Get all the standings for all the leagues for all the games from Yahoo
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<any>} The Yahoo JSON object containing league standings
 */
async function getAllStandings(uid: string): Promise<any> {
  try {
    const { data } = await httpGetAxios(
      "users;use_login=1/games;game_keys=nfl,nhl,nba,mlb/" +
        "leagues/standings?format=json",
      uid
    );
    return data;
  } catch (error: AxiosError | any) {
    console.log("Error fetching teams from Yahoo API");
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
      throw new HttpsError(
        "internal",
        "Communication with Yahoo failed: " + error.response.data
      );
    }
  }
}

/**
 * Find the team managed by the current login
 * @param {*} allTeams - an object containing all teams in the league
 * @return {*} an object containing just the user's team
 */
function getUsersTeam(allTeams: any): any {
  // TODO: Could remove this by changing the API call to return the user's team
  for (const key in allTeams) {
    if (key !== "count" && allTeams[key].team[0][3].is_owned_by_current_login) {
      return allTeams[key];
    }
  }
}

/**
 * Post the roster changes to Yahoo
 *
 * @export
 * @async
 * @param {RosterModification[]} rosterModifications
 * @param {string} uid The firebase uid of the user
 * @return {unknown}
 */
export async function postRosterChanges(
  rosterModifications: RosterModification[],
  uid: string
): Promise<void> {
  // eslint-disable-next-line guard-for-in
  for (const rosterModification of rosterModifications) {
    const { teamKey, coverageType, coveragePeriod, newPlayerPositions } =
      rosterModification;

    if (Object.keys(newPlayerPositions).length !== 0) {
      const players: any[] = [];
      // eslint-disable-next-line guard-for-in
      for (const playerKey in newPlayerPositions) {
        const position = newPlayerPositions[playerKey];
        players.push({
          player_key: playerKey,
          position: position,
        });
      }

      const data: any = {
        roster: {
          coverage_type: coverageType,
          [coverageType]: coveragePeriod,
          players: {
            player: players,
          },
        },
      };
      const xmlBody = js2xmlparser.parse("fantasy_content", data);
      try {
        await httpPutAxios(
          uid,
          "team/" + teamKey + "/roster?format=json",
          xmlBody
        );
        // write the current timestamp to the team in firebase
        updateFirestoreTimestamp(uid, teamKey);
      } catch (error: AxiosError | any) {
        console.log("Error posting roster changes for team: " + teamKey);
        if (error.response) {
          console.log(
            "Message from Yahoo: ",
            error.response.data.error.description
          );
        }
      }
    } else {
      updateFirestoreTimestamp(uid, teamKey);
    }
  }
}

/**
 * Update the last_updated timestamp in Firestore
 *
 * @async
 * @param {string} uid The firebase uid
 * @param {string} teamKey The team key
 */
async function updateFirestoreTimestamp(uid: string, teamKey: string) {
  const db = admin.firestore();
  const teamRef = db.collection("users/" + uid + "/teams").doc(teamKey);
  await teamRef.update({
    last_updated: Date.now(),
  });
}
