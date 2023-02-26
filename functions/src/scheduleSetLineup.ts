import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFunctions, TaskQueue } from "firebase-admin/functions";
import { leaguesToSetLineupsFor } from "./services/schedulingService";
import { getFunctionUrl } from "./services/utilities.service";
import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { error } from "firebase-functions/logger";
import { fetchStartingGoaliesYahoo } from "./services/yahooStartingGoalie.service";
import { db } from "./services/firestore.service";

// TODO: Refactor this function to be more readable and maintainable
// function will run every hour at 55 minutes past the hour
export const schedulesetlineup = onSchedule("55 * * * *", async (event) => {
  const leagues: string[] = await leaguesToSetLineupsFor();
  if (leagues.length === 0) {
    console.log("No leagues to set lineups for");
    return;
  }

  // Fetch starting goalies from Yahoo if there are NHL games to schedule for
  if (leagues.includes("nhl")) {
    try {
      await fetchStartingGoaliesYahoo();
    } catch (err: Error | any) {
      error("Error fetching starting goalies. " + err.message);
    }
  }

  // get all users' teams in the relevant leagues
  let teamsSnapshot: QuerySnapshot<DocumentData>;
  try {
    const teamsRef = db.collectionGroup("teams");
    teamsSnapshot = await teamsRef
      .where("is_setting_lineups", "==", true)
      .where("end_date", ">=", Date.now())
      .where("game_code", "in", leagues)
      .get();
  } catch (err: Error | any) {
    error("Error fetching teams from Firebase. " + err.message);
    console.log("Leagues: " + leagues.join(", "));
    return;
  }

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

  if (activeUsers.size === 0) {
    console.log("No users to set lineups for");
    return;
  }

  // enqueue a task for each user (with playing teams) to set their lineup
  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("dispatchsetlineup");
    targetUri = await getFunctionUrl("dispatchsetlineup");
  } catch (err: Error | any) {
    error("Error getting task queue. " + err.message);
    return;
  }

  const enqueues: any[] = [];
  activeUsers.forEach((teams, uid) => {
    enqueues.push(
      queue.enqueue(
        { uid: uid, teams: teams },
        {
          dispatchDeadlineSeconds: 60 * 5, // 5 minutes
          uri: targetUri,
        }
      )
    );
  });

  try {
    await Promise.all(enqueues);
    console.log("Successfully enqueued tasks");
  } catch (err: Error | any) {
    error("Error enqueuing tasks: " + err.message);
  }
});
