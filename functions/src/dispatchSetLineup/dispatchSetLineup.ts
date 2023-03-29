import { logger } from "firebase-functions";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { setUsersLineup } from "./services/lineupOptimizer.service";

// could increase maxConcurrentDispatches if we get more users.
export const taskQueueConfig = {
  retryConfig: {
    maxAttempts: 5,
    minBackoffSeconds: 10,
    maxDoublings: 4,
  },
  rateLimits: {
    maxConcurrentDispatches: 1000,
    maxDispatchesPerSecond: 500,
  },
};

export const dispatchsetlineup = onTaskDispatched(
  taskQueueConfig,
  async (req) => {
    // const testUsers: string[] = [
    //   "RLSrRcWN3lcYbxKQU1FKqditGDu1",
    //   "xAyXmaHKO3aRm9J3fnj2rgZRPnX2",
    // ]; // Graeme Folk, Jeff Barnes
    const uid: string = req.data.uid;
    const teams: any[] = req.data.teams;
    if (!uid) {
      logger.log("No uid provided");
      return;
    }
    if (!teams) {
      logger.log("No teams provided");
      return;
    }

    try {
      return await setUsersLineup(uid, teams);
    } catch (err: Error | any) {
      logger.error(`Error setting lineup for user ${uid}:`, err);
      logger.error("User's teams: ", teams);
    }
  }
);
