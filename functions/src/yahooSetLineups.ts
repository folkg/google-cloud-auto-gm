import * as functions from "firebase-functions";

import { setUsersLineup } from "./services/yahooLineupOptimizer.service";

// //TODO: We can possibly remove this function if we will only ever be
// // queuing tasks directly
// exports.setLineups = functions.https.onCall(async (data, context) => {
//   const uid = context.auth?.uid;
//   const rosters = await setUsersLineup(uid);
//   return rosters;
// });

exports.dispatchSetLineupTask = functions.tasks
  .taskQueue({
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 60,
    },
    rateLimits: {
      maxConcurrentDispatches: 1000,
      maxDispatchesPerSecond: 500.0,
    },
  })
  .onDispatch(async (data) => {
    const uid: string = data.uid;
    const teams: string[] = data.teams;
    if (!uid) throw new Error("No uid provided");
    if (!teams) throw new Error("No teams provided");
    await setUsersLineup(uid, teams);
  });
