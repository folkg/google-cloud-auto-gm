import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { getFunctions, TaskQueue } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { getActiveTeamsForLeagues } from "../../common/services/firebase/firestore.service";
import { getFunctionUrl } from "../../common/services/utilities.service";
import { setStartingPlayers } from "../../common/services/yahooAPI/yahooStartingPlayer.service";
import {
  enqueueUsersTeams,
  leaguesToSetLineupsFor,
  mapUsersToActiveTeams,
} from "./scheduling.service";

export async function scheduleSetLineup() {
  const leagues: string[] = await leaguesToSetLineupsFor();

  if (leagues.length === 0) {
    logger.log("No leagues to set lineups for.");
    return;
  }

  if (leagues.includes("nhl")) {
    try {
      await setStartingPlayers("nhl");
    } catch (error) {
      logger.error("Error fetching starting goalies from Yahoo ", error);
    }
  }
  if (leagues.includes("mlb")) {
    try {
      await setStartingPlayers("mlb");
    } catch (error) {
      logger.error("Error fetching starting pitchers from Yahoo ", error);
    }
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

  const activeUsers: Map<string, any[]> = mapUsersToActiveTeams(teamsSnapshot);

  if (activeUsers.size === 0) {
    logger.log("No users to set lineups for");
    return;
  }

  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("dispatchsetlineup");
    targetUri = await getFunctionUrl("dispatchsetlineup");
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
