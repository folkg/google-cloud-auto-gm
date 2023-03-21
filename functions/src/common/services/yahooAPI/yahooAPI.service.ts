import { httpGetAxios, httpPostAxios, httpPutAxios } from "./yahooHttp.service";
import { RosterModification } from "../../../dispatchSetLineup/interfaces/RosterModification";
import { Token, YahooRefreshRequestBody } from "../../interfaces/credential";
import { AxiosError } from "axios";
import { updateFirestoreTimestamp } from "../firebase/firestore.service";
import { PlayerTransaction } from "../../../dispatchSetLineup/interfaces/PlayerTransaction";
const js2xmlparser = require("js2xmlparser");

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
    "/players;out=percent_started,percent_owned,ranks,opponent,starting_status" +
    ";ranks=last30days,last14days,projected_next7days,projected_season_remaining,last4weeks,projected_week,projected_next4weeks" +
    ";percent_started.cut_types=diamond" +
    ";percent_owned.cut_types=diamond" +
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
 * Will fetch the top 25 free agents for the given league, based on rank over
 * the last 14 days
 *
 * @export
 * @async
 * @param {string} leagueKey - The league key
 * @param {string} uid - The Yahoo user ID
 * @return {Promise<any>}
 */
export async function getFreeAgents(
  leagueKey: string,
  uid: string
): Promise<any> {
  //sort=AR_L30;sort_type=lastmonth
  const url =
    "users;use_login=1/games;game_keys=nhl,nfl,nba,mlb/leagues;league_keys=" +
    leagueKey +
    "/players;status=A;sort=AR_L14;sort_type=biweekly" +
    ";out=percent_started,percent_owned,ranks,opponent,starting_status" +
    ";ranks=last30days,last14days,projected_next7days,projected_season_remaining,last4weeks,projected_week,projected_next4weeks" +
    ";percent_started.cut_types=diamond" +
    ";percent_owned.cut_types=diamond" +
    "?format=json";

  try {
    const { data } = await httpGetAxios(url, uid);
    return data;
  } catch (err: AxiosError | any) {
    const errMessage =
      "Error in getFreeAgents. User: " + uid + " League: " + leagueKey;
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
        console.log(
          "Successfully posted roster changes for team: " +
            teamKey +
            " for user: " +
            uid
        );
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
      console.log(
        "Successfully completed. No changes to post for team: " +
          teamKey +
          " for user: " +
          uid
      );
      updateFirestoreTimestamp(uid, teamKey);
    }
  }
}

/**
 * Post the roster add/drop transactions to Yahoo
 *
 * @export
 * @async
 * @param {PlayerTransaction} rosterTransactions The roster transactions.
 * Shall contain the teamKey and the players to add/drop for a single transaction. This means that
 * the players array shall contain only 1 or 2 players.
 * @param {string} uid The Yahoo uid of the user
 * @return {Promise<void>}
 */
export async function postRosterAddDropTransaction(
  rosterTransactions: PlayerTransaction,
  uid: string
): Promise<void> {
  const { teamKey, players } = rosterTransactions;
  if (Object.keys(players).length === 1 || Object.keys(players).length === 2) {
    const playersToMove = players.map((player) => {
      return {
        player_key: player.playerKey,
        transaction_data: {
          type: player.transactionType,
          [player.transactionType === "add"
            ? "destination_team_key"
            : "source_team_key"]: teamKey,
        },
      };
    });
    const transactionType =
      playersToMove.length === 1
        ? playersToMove[0].transaction_data.type
        : "add/drop";
    const data: any = {
      transaction: {
        type: transactionType,
        players: playersToMove,
      },
    };
    const isWaiverClaim = false;
    if (isWaiverClaim) data.transaction.faab_bid = 0;
    const xmlBody = js2xmlparser.parse("fantasy_content", data);
    const leagueKey = teamKey.split(".t")[0];
    try {
      await httpPutAxios(
        uid,
        "league/" + leagueKey + "/transactions?format=json",
        xmlBody
      );
      console.log(
        `Successfully posted ${transactionType} transaction for team: ${teamKey} for user: ${uid}`
      );
    } catch (err: AxiosError | any) {
      const errMessage =
        "Error in postRosterAddDropTransaction. User: " +
        uid +
        " Team: " +
        teamKey;
      handleAxiosError(err, errMessage);
    }
  } else {
    console.warn(
      `Invalid number of players to move: ${players.length} for team: ${teamKey} for user: ${uid}. Must be 1 or 2.`
    );
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
