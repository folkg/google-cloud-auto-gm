import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { fetchTeamsFromYahoo } from "./services/yahooAPI.service";

export const refreshteams = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }
  const db = admin.firestore();
  const existingTeams: string[] = [];

  const [yahooTeams, teamsSnapshot] = await Promise.all([
    fetchTeamsFromYahoo(uid),
    db.collection("users/" + uid + "/teams").get(),
  ]);
  console.log(yahooTeams);
  console.log("Fetched teams from Firebase:");
  teamsSnapshot.forEach((doc) => {
    existingTeams.push(doc.id);
  });
  console.log(existingTeams);

  const batch = db.batch();

  // Check each team from Yahoo and add it to batch if it isn't in firestore
  for (const yTeam of yahooTeams) {
    if (!existingTeams.includes(yTeam.team_key)) {
      console.log("Adding team to batch: " + yTeam.team_key);
      const data: any = yTeam;
      const docId = String(yTeam.team_key);
      // remove the team_key from the data since it will be the doc id
      delete data.team_key;
      const docRef = db.collection("users/" + uid + "/teams").doc(docId);
      batch.set(docRef, data);
    }
  }
  await batch.commit();
});
