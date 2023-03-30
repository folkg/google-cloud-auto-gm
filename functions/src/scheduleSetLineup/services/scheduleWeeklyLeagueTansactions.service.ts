import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { getFunctions, TaskQueue } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { getActiveWeeklyTeams } from "../../common/services/firebase/firestore.service";
import { getFunctionUrl } from "../../common/services/utilities.service";
import { enqueueUsersTeams, mapUsersToActiveTeams } from "./scheduling.service";

export async function scheduleWeeklyLeagueTransactions() {
  let teamsSnapshot: QuerySnapshot<DocumentData>;
  try {
    teamsSnapshot = await getActiveWeeklyTeams();
  } catch (err) {
    logger.error("Error fetching weekly teams from Firebase.", err);
    return;
  }

  const activeUsers: Map<string, any[]> = mapUsersToActiveTeams(teamsSnapshot);

  if (activeUsers.size === 0) {
    logger.log("No users to set lineups for");
    return;
  }

  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("dispatchweeklyleaguetransactions");
    targetUri = await getFunctionUrl("dispatchweeklyleaguetransactions");
  } catch (err) {
    logger.error("Error getting task queue. ", err);
    return;
  }

  const enqueuedTasks = enqueueUsersTeams(activeUsers, queue, targetUri);

  try {
    await Promise.all(enqueuedTasks);
    logger.log("Successfully enqueued tasks");
  } catch (err) {
    logger.error("Error enqueuing tasks: ", err);
  }
}
