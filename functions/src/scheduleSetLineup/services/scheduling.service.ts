import axios, { AxiosError } from "axios";
import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { TaskQueue } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { db } from "../../common/services/firebase/firestore.service";
import { getPacificTimeDateString } from "../../common/services/utilities.service";
import { fetchStartingPlayers } from "../../common/services/yahooAPI/yahooStartingPlayer.service";
import { GameStartTimes } from "../interfaces/gameStartTime";

/**
 * Determine the leagues that we will set lineups for at this time
 * Any games that are starting in the next hour will be set.
 * All leagues with games today will be set if this is the first execution of
 * the day.
 *
 *
 * @export
 * @async
 * @return {Promise<string[]>} - The leagues that will have lineups set
 */
export async function leaguesToSetLineupsFor(): Promise<string[]> {
  // load all of the game start times for today
  const todayDate: string = getPacificTimeDateString(new Date());
  let leagues: string[];
  const { loadedFromDB, gameStartTimes } = await loadTodaysGames(todayDate);
  if (loadedFromDB) {
    // If the games were loaded from the database, then check if any games are
    // starting in the next hour.
    leagues = findLeaguesPlayingNextHour(gameStartTimes);

    if (leagues.length === 0) {
      logger.log("No games starting in the next hour");
      // If there are no games starting in the next hour, then we will not
      // set any lineups.
      return [];
    }
  } else {
    // If this is the first time the games are being loaded, then we will
    // set the lineup for all leagues with teams playing any time today.
    leagues = Object.keys(gameStartTimes);
  }
  return leagues;
}

/**
 * Determine if there are any leagues starting games in the next hour
 *
 * @export
 * @param {GameStartTimes[]} gameStartTimes - The games for today
 * @return {{}} - The leagues that are playing in the next hour
 */
function findLeaguesPlayingNextHour(gameStartTimes: GameStartTimes) {
  const now: number = Date.now();
  const nextHour: number = now + 3600000;
  const result: string[] = [];
  for (const [league, gameTimestamps] of Object.entries(gameStartTimes)) {
    for (const timestamp of gameTimestamps) {
      if (timestamp > now && timestamp < nextHour) {
        result.push(league);
        break;
      }
    }
  }
  return result;
}

/**
 * Fetches the game start times for all leagues today
 *
 * @export
 * @async
 * @param {string} todayDate - The date to fetch the games for
 * @return {Promise<GameStartTimes[]>} - The game start times
 */
async function loadTodaysGames(todayDate: string) {
  let gameStartTimes: GameStartTimes;
  let loadedFromDB: boolean;
  const scheduleDoc = await db.collection("schedule").doc("today").get();
  const scheduleDocData = scheduleDoc.data();
  if (
    !scheduleDoc.exists ||
    !scheduleDocData ||
    scheduleDocData.date !== todayDate
  ) {
    logger.log("No games in database, fetching from internet");
    gameStartTimes = await getTodaysGames(todayDate);
    loadedFromDB = false;
  } else {
    gameStartTimes = scheduleDocData.games;
    loadedFromDB = true;
  }
  return { loadedFromDB, gameStartTimes };
}

/**
 * Fetches the game start times for the given league and date from the Yahoo
 *
 * @async
 * @param {string} todayDate - The date to fetch the games for
 * @return {Promise<GameStartTimes[]>} - The game start times
 */
async function getTodaysGames(todayDate: string): Promise<GameStartTimes> {
  const leagues: string[] = ["nba", "nhl", "nfl", "mlb"];
  // get today's gametimes for each league
  let gameStartTimes: GameStartTimes = {};
  for (const league of leagues) {
    try {
      gameStartTimes = {
        ...gameStartTimes,
        ...(await getGameTimesYahoo(league, todayDate)),
      };
    } catch (error: AxiosError | any) {
      logger.error("Error fetching games from Yahoo API", error);
      if (error.response) {
        logger.error(error.response.data);
        logger.error(error.response.status);
        logger.error(error.response.headers);
      }
      // get gamestimes from Sportsnet as a backup plan
      logger.log("Trying to get games from Sportsnet API");
      try {
        gameStartTimes = {
          ...gameStartTimes,
          ...(await getGameTimesSportsnet(league, todayDate)),
        };
      } catch (error: AxiosError | any) {
        logger.error("Error fetching games from Sportsnet API", error);
        if (error.response) {
          logger.error(error.response.data);
          logger.error(error.response.status);
          logger.error(error.response.headers);
        }
      }
    }
  }

  await db
    .collection("schedule")
    .doc("today")
    .set({ date: todayDate, games: gameStartTimes });

  return gameStartTimes;
}
/**
 * Get the game start times for a given league and date from the Yahoo API
 *
 * @async
 * @param {string} league - league to get games for
 * @param {string} todayDate - date to get games for
 * @return {unknown} - object containing league and array of game timestamps
 */
async function getGameTimesYahoo(
  league: string,
  todayDate: string
): Promise<GameStartTimes> {
  const url = `https://api-secure.sports.yahoo.com/v1/editorial/league/${league}/games;date=${todayDate}?format=json`;
  const { data } = await axios.get(url);

  // get the game timestamp for each game in the response
  const gamesJSON = data.league.games[0];
  const gameTimesSet: number[] = [];
  gamesJSON.forEach((game: any) => {
    const gameStart = Date.parse(game.game.start_time);
    gameTimesSet.push(gameStart);
  });

  const gameTimesArray = Array.from(new Set(gameTimesSet));
  // use the league as the key for the object
  return { [league]: gameTimesArray };
}

/**
 * Get the game start times for a given league and date from the Sportsnet API
 *
 * @async
 * @param {string} league - league to get games for
 * @param {string} todayDate - date to get games for
 * @return {unknown} - object containing league and array of game timestamps
 */
async function getGameTimesSportsnet(
  league: string,
  todayDate: string
): Promise<GameStartTimes> {
  const url = `https://mobile-statsv2.sportsnet.ca/scores?league=${league}&team=&day=${todayDate}`;
  const { data } = await axios.get(url);

  // get the game timestamp for each game in the response
  const gamesJSON = data.data[0].games;

  const gameTimesSet: number[] = [];
  gamesJSON.forEach((game: any) => {
    const gameStart = game.details.timestamp * 1000;
    gameTimesSet.push(gameStart);
  });

  const gameTimesArray = Array.from(new Set(gameTimesSet));
  return { [league]: gameTimesArray };
}

export async function setStartingPlayersForToday(
  teamsSnapshot: QuerySnapshot<DocumentData>
) {
  const leaguesWithStarters = ["nhl", "mlb"];

  for (const league of leaguesWithStarters) {
    const hasTeam = teamsSnapshot?.docs?.some(
      (doc) => doc.data().game_code === league
    );
    if (hasTeam) {
      try {
        await fetchStartingPlayers(league);
      } catch (error) {
        logger.error(
          `Error fetching starting players for ${league.toUpperCase()} from Yahoo`,
          error
        );
      }
    }
  }
}

export function mapUsersToActiveTeams(
  teamsSnapshot: QuerySnapshot<DocumentData>
) {
  if (teamsSnapshot.size === 0) {
    return new Map();
  }

  const result: Map<string, any[]> = new Map();
  teamsSnapshot?.docs?.forEach((doc) => {
    const team = doc.data();
    const uid = team.uid;
    team.team_key = doc.id;

    // We cannot query for both start_date <= Date.now() and end_date >= Date.now()
    // in firebase, so we need to filter start date locally
    if (team.start_date <= Date.now()) {
      const userTeams = result.get(uid);
      if (userTeams === undefined) {
        result.set(uid, [team]);
      } else {
        userTeams.push(team);
      }
    }
  });

  // log all user keys
  result.forEach((teams, uid) => {
    logger.log(`Found ${teams.length} teams for user ${uid}`);
  });

  return result;
}

export function enqueueUsersTeams(
  activeUsers: Map<string, any[]>,
  queue: TaskQueue<Record<string, any>>,
  targetFunctionUri: string
) {
  const result: any[] = [];

  activeUsers.forEach((teams, uid) => {
    result.push(
      queue.enqueue(
        { uid, teams },
        {
          dispatchDeadlineSeconds: 60 * 5,
          uri: targetFunctionUri,
        }
      )
    );
  });

  return result;
}
