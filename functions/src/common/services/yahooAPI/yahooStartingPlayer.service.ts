import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  getIntradayTeams,
  getStartingPlayersFromFirestore,
  storeStartingPlayersInFirestore,
} from "../firebase/firestore.service";
import { getChild } from "../utilities.service";
import { getStartingPlayers } from "./yahooAPI.service";

let NHL_STARTING_GOALIES: string[];
export function getNHLStartingGoalies(): string[] {
  return NHL_STARTING_GOALIES;
}

let MLB_STARTING_PITCHERS: string[];
export function getMLBStartingPitchers(): string[] {
  return MLB_STARTING_PITCHERS;
}

/**
 * Fetches the starting goalies from Yahoo API
 *
 * @export
 * @async
 * @param {string} league - the league to fetch starting goalies for
 * @return {Promise<void>} void
 */
export async function setStartingPlayers(league: string): Promise<void> {
  // get a team from firestore where weekly_deadline='intraday' and game='nhl'
  // we will use their access token to get the starting goalies for all users

  const teamsSnapshot: QuerySnapshot<DocumentData> = await getIntradayTeams(
    league
  );
  if (teamsSnapshot.empty) {
    throw new Error(
      `No teams found with weekly_deadline='intraday' and game=${league.toUpperCase}`
    );
  }

  const teamKey = teamsSnapshot.docs[0].id;
  const leagueKey = teamKey.split(".t")[0];
  const uid = teamsSnapshot.docs[0].data().uid;
  const startingPlayers: string[] = await parseStartingPlayersFromYahoo(
    league,
    uid,
    leagueKey
  );

  const startersGloablArray: { [key: string]: string[] } = {
    nhl: NHL_STARTING_GOALIES,
    mlb: MLB_STARTING_PITCHERS,
  };

  // TODO: add test for NHL, MLB, and NBA
  // TODO: will this still work if the array is uninitalized and empty?
  console.log("league: ", league);
  console.log("Starting players: ", startingPlayers);
  startersGloablArray[league] &&= startingPlayers;

  await storeStartingPlayersInFirestore(startingPlayers, league);
}

/**
 * Populates the starting goalies array
 *
 * @async
 * @param {string} league - the league to fetch starting players for
 * @param {string} uid - the user's uid
 * @param {string} leagueKey - the league key
 * @return {Promise<void>}
 */
async function parseStartingPlayersFromYahoo(
  league: string,
  uid: string,
  leagueKey: string
): Promise<string[]> {
  logger.log(
    `Loading starting players from Yahoo for ${league.toUpperCase}. Logging this to see if it's called more than once.`
  );
  const result: string[] = [];

  const startingPlayers = await getStartingPlayers(league, uid, leagueKey);
  if (startingPlayers) {
    for (const playersJSON of startingPlayers) {
      const players = playersJSON.fantasy_content.league[1].players;
      for (const key in players) {
        if (key !== "count") {
          result.push(getChild(players[key].player[0], "player_key"));
        }
      }
    }
  }

  return result;
}

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

export async function initStartingPitchers(): Promise<void> {
  if (!MLB_STARTING_PITCHERS) {
    MLB_STARTING_PITCHERS = await getStartingPlayersFromFirestore("mlb");
    logger.log(
      "Initialized MLB starting pitchers global array from Firestore. Logging this to see how many times it is called."
    );
  } else {
    logger.log(
      "MLB starting pitchers global array already initialized within this instance, NOT fetching from Firestore."
    );
  }
}
