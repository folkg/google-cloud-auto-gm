import { logger } from "firebase-functions";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { RevokedRefreshTokenError } from "../common/services/firebase/errors.js";
import { setUsersLineup } from "./services/setLineups.service.js";

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
    } catch (error) {
      if (error instanceof RevokedRefreshTokenError) {
        logger.log(error);
      } else {
        logger.error(`Error setting lineup for user ${uid}:`, error);
        logger.error("User's teams: ", teams);
      }
    }
  }
);
