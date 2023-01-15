import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFunctions } from "firebase-admin/functions";
import {
  loadTodaysGames,
  findLeaguesPlayingNextHour,
} from "./services/schedulingService";
import { GameStartTimes } from "./interfaces/gameStartTime";

// function will run every hour at 54 minutes past the hour
exports.scheduleSetLineup = functions.pubsub
  .schedule("54 * * * *")
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

    // load all of the game start times for today
    const gameStartTimes: GameStartTimes[] = await loadTodaysGames(
      db,
      todayDate
    );

    // check if any games are starting in the next hour
    let leaguesPlayingNextHour: string[] =
      findLeaguesPlayingNextHour(gameStartTimes);

    // TODO: comment out this next line. It is here just to test the function.
    // leaguesPlayingNextHour = ["nba", "nfl", "nhl", "mlb"];
    if (leaguesPlayingNextHour.length === 0) {
      console.log("No games starting in the next hour");
      return;
    }

    // get all user's teams in leagues that are playing in the next hour
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

    // enqueue a task for each user (with playing teams) to set their lineup
    const queue = getFunctions().taskQueue("dispatchSetLineupTask");
    const enqueues: any[] = [];
    activeUsers.forEach((teams, uid) => {
      enqueues.push(
        queue.enqueue(
          { uid: uid, teams: teams },
          {
            dispatchDeadlineSeconds: 60 * 5, // 5 minutes
          }
        )
      );
    });

    try {
      await Promise.all(enqueues);
      console.log("Successfully enqueued tasks");
    } catch (err) {
      console.log("Error enqueuing tasks");
      console.log(err);
    }
  });
