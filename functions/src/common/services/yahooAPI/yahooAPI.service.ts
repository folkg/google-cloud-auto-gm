import { AxiosError } from "axios";
import { logger } from "firebase-functions";
import { LineupChanges } from "../../../dispatchSetLineup/interfaces/LineupChanges";
import { PlayerTransaction } from "../../../dispatchSetLineup/interfaces/PlayerTransaction";
import { Token, YahooRefreshRequestBody } from "../../interfaces/credential";
import { updateFirestoreTimestamp } from "../firebase/firestore.service";
import {
  httpGetAxios,
  httpPostAxiosAuth,
  httpPostAxiosUnauth,
  httpPutAxios,
} from "./yahooHttp.service";
import { getChild } from "../utilities.service";
const js2xmlparser = require("js2xmlparser");
require("dotenv").config();

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
    const { data } = await httpPostAxiosUnauth(url, body);
    // Get the token info from the response and save it to the database
    const accessToken = data.access_token;
    const tokenExpirationTime = data.expires_in * 1000 + requestTime;
    const token: Token = {
      accessToken: accessToken,
      refreshToken: data.refresh_token,
      tokenExpirationTime: tokenExpirationTime,
    };

    return token;
  } catch (error: AxiosError | unknown) {
    handleAxiosError(error, null);
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
 * @param {string} [date=""] - The date to get the roster for. Defaults to today.
 * @return {Promise<any>} The Yahoo JSON object containing the rosters
 */
export async function getRostersByTeamID(
  teams: string[],
  uid: string,
  date = ""
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
    ";out=settings/teams;out=transactions,games_played;transactions.types=waiver,pending_trade/roster;date=" +
    date +
    "/players;out=percent_started,percent_owned,ranks,opponent,starting_status" +
    ";ranks=last30days,last14days,projected_next7days,projected_season_remaining,last4weeks,projected_week,projected_next4weeks" +
    ";percent_started.cut_types=diamond" +
    ";percent_owned.cut_types=diamond" +
    "?format=json";

  try {
    const { data } = await httpGetAxios(url, uid);
    return data;
  } catch (err: AxiosError | unknown) {
    const errMessage = `Error in getRostersByTeamID. User: ${uid} Teams: ${teams}`;
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
  // sort=AR_L30;sort_type=lastmonth
  const url =
    "users;use_login=1/games;game_keys=nhl,nfl,nba,mlb/leagues;league_keys=" +
    leagueKey +
    "/players;status=A;sort=AR_L14;sort_type=biweekly" +
    ";out=ownership,percent_started,percent_owned,ranks,opponent,starting_status" +
    ";ranks=last30days,last14days,projected_next7days,projected_season_remaining,last4weeks,projected_week,projected_next4weeks" +
    ";percent_started.cut_types=diamond" +
    ";percent_owned.cut_types=diamond" +
    "?format=json";

  try {
    const { data } = await httpGetAxios(url, uid);
    return data;
  } catch (err: AxiosError | unknown) {
    const errMessage = `Error in getFreeAgents. User: ${uid} League: ${leagueKey}`;
    handleAxiosError(err, errMessage);
  }
}

/**
 * Get all the standings for all the leagues for all the games from Yahoo
 *
 * @export
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<any>} The Yahoo JSON object containing league standings
 */
export async function getAllStandings(uid: string): Promise<any> {
  try {
    const { data } = await httpGetAxios(
      "users;use_login=1/games;game_keys=nfl,nhl,nba,mlb/leagues;out=settings,standings?format=json",
      uid
    );
    return data;
  } catch (err: AxiosError | unknown) {
    const errMessage = `Error in getAllStandings. User: ${uid}`;
    handleAxiosError(err, errMessage);
  }
}

/**
 * Get the projected/confirmed starting players for the league
 * ie. goalies from NHL, pitchers from MLB
 *
 * @export
 * @async
 * @param {string} league - The league, ie. nhl, mlb
 * @param {string} uid - The firebase uid
 * @param {string} leagueKey - The user's Yahoo league key (ie. nhl.l.123)
 * @return {Promise<any>} The Yahoo JSON object containing raw start data
 */
export async function getStartingPlayers(
  league: string,
  uid: string,
  leagueKey: string
) {
  const starterPositions: { [key: string]: string } = {
    nhl: "S_G",
    mlb: "S_P",
  };
  const positions = starterPositions[league];
  if (!positions) return [];

  try {
    // There could be up to 32 starting players, so we need to make 2 calls
    // to get all the players. The first call will get the first 25 players.
    const urlBase = `league/${leagueKey}/players;position=${positions};sort=AR;start=`;
    const [result1, result2] = await Promise.all([
      httpGetAxios(`${urlBase}0?format=json`, uid),
      httpGetAxios(`${urlBase}25?format=json`, uid),
    ]);
    return [result1.data, result2.data];
  } catch (err: AxiosError | unknown) {
    const errMessage = `Error in getStartingPlayers. User: ${uid} League: ${leagueKey} Position: ${positions}`;
    handleAxiosError(err, errMessage);
  }
}

export async function getMLBSPFromYahoo() {
  try {
    // There should be at least 200 SP, so we need to make 8 calls, then loop for more
    const urlBase =
      "games;game_keys=mlb/players;position=SP;out=percent_owned;sort=R_PO;start=";
    const initialGetRequests = [];
    for (let i = 0; i < 8; i++) {
      initialGetRequests.push(httpGetAxios(`${urlBase}${i * 25}?format=json`));
    }
    const playerJSONs = await Promise.all(initialGetRequests);
    const playerKeys = playerJSONs.flatMap((response) =>
      parsePlayerKeysFromYahooJSON(response.data)
    );
    // TODO: This isn't quite right. We need to flag if the player ownership is 0 somewhere
    if (playerKeys[-1]) {
      // There are more than 200 SP, so we need to loop for more
      let i = 0;
      while (playerKeys[-1]) {
        const { data } = await httpGetAxios(
          `${urlBase}${(i + 8) * 25}?format=json`
        );
        playerKeys.push(...parsePlayerKeysFromYahooJSON(data));
        i++;
      }
    }
    // TODO: Move the parse starting players logic from the yahooStartingPlayer service into here for the getStartingPlayers function too
    return playerKeys;
  } catch (err: AxiosError | unknown) {
    handleAxiosError(err, "Error in getMLBSPFromYahoo");
  }
}

function parsePlayerKeysFromYahooJSON(playersJSON: any): string[] {
  const result: string[] = [];
  const players = playersJSON.fantasy_content.league[1].players;
  for (const key in players) {
    if (key !== "count") {
      result.push(getChild(players[key].player[0], "player_key"));
    }
  }
  return result;
}

/**
 * Post the roster changes to Yahoo
 *
 * @export
 * @async
 * @param {LineupChanges[]} lineupChanges
 * @param {string} uid The firebase uid of the user
 * @return {unknown}
 */
export async function putLineupChanges(
  lineupChanges: LineupChanges[],
  uid: string
): Promise<void> {
  for (const lineupChange of lineupChanges) {
    const { teamKey, coverageType, coveragePeriod, newPlayerPositions } =
      lineupChange;
    if (Object.keys(newPlayerPositions).length !== 0) {
      const players = [];
      for (const [playerKey, position] of Object.entries(newPlayerPositions)) {
        players.push({ player_key: playerKey, position });
      }

      const data = {
        roster: {
          coverage_type: coverageType,
          [coverageType]: coveragePeriod,
          players: { player: players },
        },
      };

      const XML_NAMESPACE = "fantasy_content";
      const xmlBody = js2xmlparser.parse(XML_NAMESPACE, data);

      try {
        await httpPutAxios(uid, `team/${teamKey}/roster?format=json`, xmlBody);
        logger.log(
          `Successfully put roster changes for team: ${teamKey} for user: ${uid}`
        );
        updateFirestoreTimestamp(uid, teamKey);
      } catch (err: AxiosError | unknown) {
        const errMessage = `Error in putLineupChanges. User: ${uid} Team: ${teamKey}`;
        handleAxiosError(err, errMessage);
      }
    } else {
      updateFirestoreTimestamp(uid, teamKey);
    }
  }
}

/**
 * Post the roster add/drop transactions to Yahoo
 *
 * @export
 * @async
 * @param {PlayerTransaction} transaction The roster transactions.
 * Shall contain the teamKey and the players to add/drop for a single transaction. This means that
 * the players array shall contain only 1 or 2 players.
 * @param {string} uid The Yahoo uid of the user
 * @return {Promise<void>}
 */
export async function postRosterAddDropTransaction(
  transaction: PlayerTransaction,
  uid: string
): Promise<boolean> {
  const { teamKey, players } = transaction;

  const validPlayerCount = [1, 2].includes(players.length);
  if (!validPlayerCount) {
    logger.warn(
      `Invalid number of players to move: ${players.length} for team: ${teamKey} for user: ${uid}. Must be 1 or 2.`
    );
    return false;
  }
  const XMLPlayers = players.map((player) => ({
    player_key: player.playerKey,
    transaction_data: {
      type: player.transactionType,
      [player.transactionType === "add"
        ? "destination_team_key"
        : "source_team_key"]: teamKey,
    },
  }));
  XMLPlayers.sort((a, b) =>
    a.transaction_data.type > b.transaction_data.type ? 1 : -1
  ); // sorts add before drop

  const transactionType =
    XMLPlayers.length === 1 ? XMLPlayers[0].transaction_data.type : "add/drop";

  const isWaiverClaim = false; // TODO: Implement waiver claim logic later
  const data = {
    transaction: {
      type: transactionType,
      ...(XMLPlayers.length === 1 && { player: XMLPlayers[0] }),
      ...(XMLPlayers.length === 2 && { players: { player: XMLPlayers } }),
      ...(isWaiverClaim ? { faab_bid: 0 } : {}),
    },
  };

  const XML_NAMESPACE = "fantasy_content";
  const xmlBody = js2xmlparser.parse(XML_NAMESPACE, data);

  const leagueKey = teamKey.split(".t")[0];
  try {
    await httpPostAxiosAuth(uid, `league/${leagueKey}/transactions`, xmlBody);
    logger.log(
      `Successfully posted ${transactionType} transaction for team: ${teamKey} for user: ${uid}.`
    );
    logger.log(`Transaction data: ${data}`);
    return true;
  } catch (error) {
    const errMessage = `Error in postRosterAddDropTransaction. User: ${uid} Team: ${teamKey}`;
    handleAxiosError(error, errMessage);
  }
}

/**
 * Handle the axios error
 *
 * @param {AxiosError} err - The axios error
 * @param {string} message - The message to throw
 */
function handleAxiosError(
  err: AxiosError | any,
  message: string | null
): never {
  const errMessage = message ? `${message}. ` : "";
  if (err.response) {
    logger.error(errMessage, err.response);
    throw new Error(
      `${errMessage}Error status: ${err.response.status}: ${err.response.data}`
    );
  } else if (err.request) {
    logger.error(errMessage, err.request);
    throw new Error(`${errMessage}${err.request}`);
  } else {
    logger.error(errMessage, err.message);
    throw new Error(`${errMessage}${err.message}`);
  }
}
