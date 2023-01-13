import * as functions from "firebase-functions";
import {RosterModification} from "./interfaces/roster";
import {postRosterChanges} from "./services/yahooAPI.service";
// import * as admin from "firebase-admin";

import {fetchRostersFromYahoo} from "./services/yahooLineupBuilder.service";
import {optimizeStartingLineup} from "./services/yahooLineupOptimizer.service";

exports.setLineups = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to get an access token"
    );
  }
  // TODO: Get gameIDs or teamIDs from data
  // currently just using nhl and nfl hardcoded for testing
  const rosters = await fetchRostersFromYahoo("nhl,nfl", uid);

  const rosterModifications: RosterModification[] = [];
  for (const roster of rosters) {
    const rm = optimizeStartingLineup(roster);
    if (rm) {
      rosterModifications.push(rm);
    }
  }

  postRosterChanges(rosterModifications, uid);
  return rosters;
});
