import { error } from "firebase-functions/logger";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { setUsersLineup } from "./services/yahooLineupOptimizer.service";

export const dispatchsetlineup = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 10,
      maxDoublings: 4,
    },
    rateLimits: {
      maxConcurrentDispatches: 5,
      maxDispatchesPerSecond: 500,
    },
  },
  async (req) => {
    const uid: string = req.data.uid;
    const teams: string[] = req.data.teams;
    if (!uid) {
      console.log("No uid provided");
      return;
    }
    if (!teams) {
      console.log("No teams provided");
      return;
    }

    try {
      return await setUsersLineup(uid, teams);
    } catch (err: Error | any) {
      error("Error setting lineup for user " + uid + ". " + err.message);
      console.log("User's teams: " + teams);
    }
  }
);
