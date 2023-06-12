import { getApps, initializeApp } from "firebase-admin/app";
import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { TaskQueue, getFunctions } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { getActiveTeamsForLeagues } from "../../common/services/firebase/firestore.service.js";
import {
  getCurrentPacificHour,
  getFunctionUrl,
} from "../../common/services/utilities.service.js";
import {
  enqueueUsersTeams,
  leaguesToSetLineupsFor,
  mapUsersToActiveTeams,
  setStartingPlayersForToday,
} from "./scheduling.service.js";

if (getApps().length === 0) {
  initializeApp();
}

export async function scheduleSetLineup() {
  // We want the first run of the function to be at 1:55 AM Pacific Time
  // Waiver claims hadn't been fully proceseed at 0:55 AM
  if (getCurrentPacificHour() === 0) return;

  const leagues: string[] = await leaguesToSetLineupsFor();
  if (leagues.length === 0) {
    logger.log("No leagues to set lineups for.");
    return;
  }

  let teamsSnapshot: QuerySnapshot<DocumentData>;
  try {
    teamsSnapshot = await getActiveTeamsForLeagues(leagues);
  } catch (error) {
    logger.error(
      `Error fetching teams from Firebase for Leagues: ${leagues.join(", ")}`,
      error
    );
    return;
  }

  await setStartingPlayersForToday(teamsSnapshot);

  const activeUsers: Map<string, any[]> = mapUsersToActiveTeams(teamsSnapshot);
  if (activeUsers.size === 0) {
    logger.log("No users to set lineups for");
    return;
  }

  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("lineup-dispatchsetlineup");
    targetUri = await getFunctionUrl("lineup-dispatchsetlineup");
  } catch (error) {
    logger.error("Error getting task queue. ", error);
    return;
  }

  const enqueuedTasks = enqueueUsersTeams(activeUsers, queue, targetUri);

  try {
    await Promise.all(enqueuedTasks);
    logger.log("Successfully enqueued tasks");
  } catch (error) {
    logger.error("Error enqueuing tasks: ", error);
  }
}
