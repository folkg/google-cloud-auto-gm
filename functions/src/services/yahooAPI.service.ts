import * as admin from "firebase-admin";
import { httpGetAxios, httpPostAxios, httpPutAxios } from "./yahooHttp.service";
import { RosterModification } from "../interfaces/roster";
import { Token, YahooRefreshRequestBody } from "../interfaces/credential";
import { AxiosError } from "axios";
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

  try {
    const requestTime = Date.now();
    const { data } = await httpPostAxios(url, body);
    // Get the token info from the response and save it to the database
    const accessToken = data.access_token;
    const tokenExpirationTime = data.expires_in * 1000 + requestTime;
    const token: Token = {
      accessToken: accessToken,
      refreshToken: data.refresh_token,
      tokenExpirationTime: tokenExpirationTime,
    };

    return token;
  } catch (error: AxiosError | any) {
    handleAxiosError(error, null);
    return Promise.reject(error);
  }
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
  } catch (err: AxiosError | any) {
    const errMessage =
      "Error in getRostersByTeamID. User: " + uid + " Teams: " + teams;
    handleAxiosError(err, errMessage);
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
  } catch (err: AxiosError | any) {
    const errMessage = "Error in getAllStandings. User: " + uid;
    handleAxiosError(err, errMessage);
  }
}

/**
 * Get the projected/confirmed starting goalies for the league
 *
 * This will return starting goalies based on the weekly_deadline
 * ie. intraday leagues will return today's starters, while daily leagues
 * will return tomorrow's starters
 *
 * @export
 * @async
 * @param {string} uid The firebase uid
 * @param {string} leagueKey The league key
 * @return {Promise<any>} The Yahoo JSON object containing goalie data
 */
export async function getStartingGoalies(
  uid: string,
  leagueKey: string
): Promise<any> {
  try {
    // There could be up to 32 starting goalies, so we need to make 2 calls
    // to get all the goalies. The first call will get the first 25 goalies.
    const [data1, data2] = await Promise.all([
      await httpGetAxios(
        "league/" +
          leagueKey +
          "/players;position=S_G;sort=AR;start=0?format=json",
        uid
      ),
      await httpGetAxios(
        "league/" +
          leagueKey +
          "/players;position=S_G;sort=AR;start=25?format=json",
        uid
      ),
    ]);
    return [data1.data, data2.data];
  } catch (err: AxiosError | any) {
    const errMessage =
      "Error in getStartingGoalies. Using User: " +
      uid +
      " League: " +
      leagueKey;
    handleAxiosError(err, errMessage);
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
export async function postRosterModifications(
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
      } catch (err: AxiosError | any) {
        const errMessage =
          "Error in postRosterModifications. User: " +
          uid +
          " Team: " +
          teamKey;
        handleAxiosError(err, errMessage);
      }
    } else {
      updateFirestoreTimestamp(uid, teamKey);
    }
  }
}

/**
 * Handle the axios error
 *
 * @param {(AxiosError | any)} err - The axios error
 * @param {string} message - The message to throw
 */
function handleAxiosError(err: AxiosError | any, message: string | null): void {
  const errMessage = message ? message + ". " : "";
  if (err.response) {
    throw new Error(
      errMessage +
        "Error status: " +
        err.response.status +
        ": " +
        JSON.stringify(err.response.data)
    );
  } else if (err.request) {
    throw new Error(errMessage + err.request);
  } else {
    throw new Error(errMessage + err.message);
  }
}
