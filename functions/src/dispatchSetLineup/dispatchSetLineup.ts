import { error } from "firebase-functions/logger";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { setUsersLineup2 } from "./services/newLineupOptimizer.service";
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
    const testUsers: string[] = [
      "RLSrRcWN3lcYbxKQU1FKqditGDu1",
      "xAyXmaHKO3aRm9J3fnj2rgZRPnX2",
    ]; // Graeme Folk, Jeff Barnes
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
      if (testUsers.includes(uid)) {
        // test out new lineup optimizer for the test users
        return await setUsersLineup2(uid, teams);
      } else {
        // use the old lineup optimizer for everyone else
        return await setUsersLineup(uid, teams);
      }
    } catch (err: Error | any) {
      error("Error setting lineup for user " + uid + ". " + err.message);
      console.log("User's teams: " + teams);
    }
  }
);
