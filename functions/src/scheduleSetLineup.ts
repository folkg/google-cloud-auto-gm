import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFunctions } from "firebase-admin/functions";
import {
  loadTodaysGames,
  findLeaguesPlayingNextHour,
} from "./services/schedulingService";

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
    const { loadedFromDB, gameStartTimes } = await loadTodaysGames(
      db,
      todayDate
    );

    let leagues: string[];
    if (loadedFromDB) {
      // If the games were loaded from the database, then check if any games are
      // starting in the next hour.
      leagues = findLeaguesPlayingNextHour(gameStartTimes);

      if (leagues.length === 0) {
        console.log("No games starting in the next hour");
        // If there are no games starting in the next hour, then we will not
        // set any lineups.
        return;
      }
    } else {
      // If this is the first time the games are being loaded, then we will
      // set the lineup for all leagues with teams playing any time today.
      leagues = gameStartTimes.map((game) => game.league);
    }

    // get all user's teams in the relevant leagues
    const teamsRef = db.collectionGroup("teams");
    const teamsSnapshot = await teamsRef
      .where("is_setting_lineups", "==", true)
      .where("end_date", ">=", Date.now())
      .where("game_code", "in", leagues)
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
