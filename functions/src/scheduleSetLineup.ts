// 1. Query all sports being played in the next hour (Yahoo or ESPN)
// 2. Query all teams where is_setting_lineups = true and sport is being
// played in the next hour
// 3. Loop through each team and create a map of user_id to list of teams
// 4. Loop through each user and add a task to the tasks queue to set the
// lineup for each team

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  loadTodaysGames,
  findLeaguesPlayingNextHour,
} from "./services/schedulingService";
import { GameStartTimes } from "./interfaces/gameStartTime";

// function will run every hour at 50 minutes past the hour
exports.scheduleSetLineup = functions.pubsub
  .schedule("50 * * * *")
  .onRun(async (context) => {
    const db = admin.firestore();

    // get games for today for all sports
    // Convert UTC time to Pacific Time to ensure all games are finished
    const today: Date = new Date();
    const todayPTC: string = today.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayDateParts: string[] = todayPTC.split("/");
    const todayDate =
      todayDateParts[2] + "-" + todayDateParts[0] + "-" + todayDateParts[1];

    // load the games from the DB first, then from the internet if required
    const gameStartTimes: GameStartTimes[] = await loadTodaysGames(
      db,
      todayDate
    );

    // check if any games are starting in the next hour
    let leaguesPlayingNextHour: string[] =
      findLeaguesPlayingNextHour(gameStartTimes);

    // TODO: Can comment this out for testing
    leaguesPlayingNextHour = ["nba", "nfl", "nhl", "mlb"];
    if (leaguesPlayingNextHour.length === 0) {
      console.log("No games starting in the next hour");
      return;
    }
    // get all teams and users that are playing in the next hour
    const teamsRef = db.collectionGroup("teams");
    const teamsSnapshot = await teamsRef
      .where("is_setting_lineups", "==", true)
      .where("end_date", ">=", Date.now())
      .where("game_code", "in", leaguesPlayingNextHour)
      .get();

    // create a map of user_id to list of teams
    const activeUsers: Map<string, string[]> = new Map();
    teamsSnapshot.forEach((doc) => {
      const team = doc.data();
      const userTeams = activeUsers.get(team.uid);
      if (userTeams === undefined) {
        activeUsers.set(team.uid, [doc.id]);
      } else {
        userTeams.push(doc.id);
      }
    });
    console.log("the final users Map looks like:");
    console.log(activeUsers);

    // TODO: Create a tasks queue to set the lineup for each user
    // TODO: In the setLineupFunction we need to query the DB for all user
    // teams and make sure they want the lineups set
    // TODO: we need to also check if the league is still before end date
    // If not, we need to update the user's teams in the DB
  });
