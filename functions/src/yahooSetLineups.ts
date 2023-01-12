import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";

import {fetchRostersFromYahoo} from "./services/yahooLineupBuilder.service";

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
  const results = await fetchRostersFromYahoo("nhl,nfl", uid);
  return results;
});
