import * as admin from "firebase-admin";
import axios, {AxiosError} from "axios";
import {GameStartTimes} from "../interfaces/gameStartTime";

/**
 * Determine if there are any leagues starting games in the next hour
 *
 * @export
 * @param {GameStartTimes[]} gameStartTimes - The games for today
 * @return {{}} - The leagues that are playing in the next hour
 */
export function findLeaguesPlayingNextHour(gameStartTimes: GameStartTimes[]) {
  const now: number = Date.now();
  const nextHour: number = now + 3600000;
  const leaguesPlayingNextHour: string[] = [];
  for (const game of gameStartTimes) {
    for (const timestamp of game.gameTimestamps) {
      if (timestamp > now && timestamp < nextHour) {
        leaguesPlayingNextHour.push(game.league);
        break;
      }
    }
  }
  return leaguesPlayingNextHour;
}

/**
 * Fetches the game start times for all leagues today
 *
 * @export
 * @async
 * @param {admin.firestore.Firestore} db - The Firestore DB
 * @param {string} todayDate - The date to fetch the games for
 * @return {Promise<GameStartTimes[]>} - The game start times
 */
export async function loadTodaysGames(
    db: admin.firestore.Firestore,
    todayDate: string
) {
  let gameStartTimes: GameStartTimes[] = [];
  let loadedFromDB: boolean;
  const scheduleDoc = await db.collection("schedule").doc("today").get();
  const scheduleDocData = scheduleDoc.data();
  if (
    !scheduleDoc.exists ||
    !scheduleDocData ||
    scheduleDocData.date !== todayDate
  ) {
    // TODO: We need to not fetch new games if there are still valid games on
    //  the schedule. This is an issue with using the UTC time.
    console.log("No games in database, fetching from internet");
    gameStartTimes = await getTodaysGames(todayDate);
    loadedFromDB = false;
  } else {
    // console.log("Games found in database");
    gameStartTimes = scheduleDocData.games;
    loadedFromDB = true;
  }
  // console.log(gameStartTimes);
  return {loadedFromDB, gameStartTimes};
}

/**
 * Fetches the game start times for the given league and date from the Yahoo
 *
 * @async
 * @param {string} todayDate - The date to fetch the games for
 * @return {Promise<GameStartTimes[]>} - The game start times
 */
async function getTodaysGames(todayDate: string): Promise<GameStartTimes[]> {
  const leagues: string[] = ["nba", "nhl", "nfl", "mlb"];
  // get today's gametimes for each league
  const gameStartTimes: GameStartTimes[] = [];
  for (const league of leagues) {
    try {
      gameStartTimes.push(await getGameTimesYahoo(league, todayDate));
    } catch (error: AxiosError | any) {
      console.log("Error fetching games from Yahoo API");
      console.log(error);
      if (error.response) {
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      }
      // get gamestimes from Sportsnet as a backup plan
      console.log("Trying to get games from Sportsnet API");
      try {
        gameStartTimes.push(await getGameTimesSportsnet(league, todayDate));
      } catch (error: AxiosError | any) {
        console.log("Error fetching games from Sportsnet API");
        if (error.response) {
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        }
      }
    }
  }

  // store the games in the DB
  const db = admin.firestore();
  await db.collection("schedule").doc("today").set({
    date: todayDate,
    games: gameStartTimes,
  });

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
  const url = `https://api-secure.sports.yahoo.com/v1/editorial/league/${league}/games;date=${todayDate};game_type=1?format=json`;
  const {data} = await axios.get(url);

  // get the game timestamp for each game in the response
  const gamesJSON = data.league.games[0];
  const gameTimesSet: number[] = [];
  gamesJSON.forEach((game: any) => {
    const gameStart = Date.parse(game.game.start_time);
    gameTimesSet.push(gameStart);
  });

  const gameTimesArray = Array.from(new Set(gameTimesSet));
  return {league: league, gameTimestamps: gameTimesArray};
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
  const {data} = await axios.get(url);

  // get the game timestamp for each game in the response
  const gamesJSON = data.data[0].games;

  const gameTimesSet: number[] = [];
  gamesJSON.forEach((game: any) => {
    const gameStart = game.details.timestamp * 1000;
    gameTimesSet.push(gameStart);
  });

  const gameTimesArray = Array.from(new Set(gameTimesSet));
  return {league: league, gameTimestamps: gameTimesArray};
}
