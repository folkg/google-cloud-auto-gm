import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { setUsersLineup } from "./services/yahooLineupOptimizer.service";

export const dispatchsetlineup = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 1000,
      maxDispatchesPerSecond: 500.0,
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
      throw new Error(
        "Error setting lineup for user " + uid + ". " + err.message
      );
    }
  }
);
