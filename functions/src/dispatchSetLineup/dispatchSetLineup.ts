import { logger } from "firebase-functions";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { RevokedRefreshTokenError } from "../common/services/firebase/errors.js";
import { setUsersLineup } from "./services/setLineups.service.js";

export const taskQueueConfig = {
  retryConfig: {
    maxAttempts: 5,
    minBackoffSeconds: 10,
    maxDoublings: 4,
  },
  rateLimits: {
    maxDispatchesPerSecond: 5,
    maxConcurrentDispatches: 40,
  },
};

export const dispatchsetlineup = onTaskDispatched(
  taskQueueConfig,
  async (req) => {
    const uid: unknown = req.data.uid;
    const teams: unknown = req.data.teams;
    if (!uid) {
      logger.log("No uid provided");
      return;
    }
    if (!teams) {
      logger.log("No teams provided");
      return;
    }

    try {
      // TODO: ArkType
      return await setUsersLineup(uid, teams);
    } catch (error) {
      if (error instanceof RevokedRefreshTokenError) {
        logger.log(error);
      } else {
        logger.error(`Error setting lineup for user ${uid}:`, error);
        logger.error("User's teams: ", teams);
      }
    }
  },
);
