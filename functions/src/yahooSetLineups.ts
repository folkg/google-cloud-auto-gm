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
    if (!uid) throw new Error("No uid provided");
    if (!teams) throw new Error("No teams provided");
    await setUsersLineup(uid, teams);
  }
);
