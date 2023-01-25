import * as admin from "firebase-admin";
import { httpGetAxios, httpPostAxios, httpPutAxios } from "./yahooHttp.service";
import { RosterModification } from "../interfaces/roster";
import { Token, YahooRefreshRequestBody } from "../interfaces/credential";
import { AxiosError } from "axios";
import { HttpsError } from "firebase-functions/v2/https";
import { updateFirestoreTimestamp } from "./firestore.service";
const js2xmlparser = require("js2xmlparser");
export const db = admin.firestore();

/**
 * Refresh the Yahoo access token for the given user
 * @param {string} refreshToken The refresh token
 * @return {Promise<Token>} The new credential
 */
export async function refreshYahooAccessToken(
  refreshToken: string
): Promise<Token> {
  let token: Token;
  try {
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

    const { data } = await httpPostAxios(url, body);
    const results = data;
    // Get the token info from the response and save it to the database
    const accessToken = results.access_token;
    const tokenExpirationTime = results.expires_in * 1000 + Date.now();
    token = {
      accessToken: accessToken,
      refreshToken: results.refresh_token,
      tokenExpirationTime: tokenExpirationTime,
    };
  } catch (error: AxiosError | any) {
    console.log("Error fetching token from Yahoo API");
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
      throw new Error(
        "Communication with Yahoo failed: " + error.response.data
      );
    }
  }
  return token!;
}

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

/**
 * Get all the standings for all the leagues for all the games from Yahoo
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<any>} The Yahoo JSON object containing league standings
 */
export async function getAllStandings(uid: string): Promise<any> {
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
