import { logger } from "firebase-functions";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { performWeeklyLeagueTransactions } from "./services/setLineups.service.js";

export const taskQueueConfig = {
  retryConfig: {
    maxAttempts: 2,
    minBackoffSeconds: 10,
    maxDoublings: 1,
  },
  rateLimits: {
    maxConcurrentDispatches: 5,
    maxDispatchesPerSecond: 5,
  },
};

export const dispatchweeklyleaguetransactions = onTaskDispatched(
  taskQueueConfig,
  async (req) => {
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
      return await performWeeklyLeagueTransactions(uid, teams);
    } catch (error) {
      logger.error(
        `Error performing weekly transactions for user ${uid}:`,
        error
      );
      logger.error("User's teams: ", teams);
    }
  }
);
