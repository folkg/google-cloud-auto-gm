import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
const db = admin.firestore();
import { getFunctions } from "firebase-admin/functions";
import { leaguesToSetLineupsFor } from "./services/schedulingService";
import { getFunctionUrl } from "./services/utilities.service";

// function will run every hour at 55 minutes past the hour
export const schedulesetlineup = onSchedule("55 * * * *", async (event) => {
  const leagues: string[] = await leaguesToSetLineupsFor();

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
  const queue = getFunctions().taskQueue("dispatchsetlineup");
  const targetUri = await getFunctionUrl("dispatchsetlineup");
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
  } catch (err) {
    console.log("Error enqueuing tasks");
    console.log(err);
  }
});
