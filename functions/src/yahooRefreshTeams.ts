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

  if (yahooTeams.length === 0) {
    throw new HttpsError(
      "internal",
      "No teams were returned from Yahoo. Please try again later."
    );
  }

  // Get the list of existing teams from firestore snapshot
  teamsSnapshot.forEach((doc) => {
    existingTeams.push(doc.id);
  });

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

  // TODO: Could keep this in case we want to update the team data from Yahoo and keep the records in DB
  // // check each team from firestore and update the record is_setting_lineups is false if it isn't in Yahoo
  // for (const eTeam of existingTeams) {
  //   if (!yahooTeams.some((yTeam) => yTeam.team_key === eTeam)) {
  //     console.log("Updating team in batch: " + eTeam);
  //     const docRef = db.collection("users/" + uid + "/teams").doc(eTeam);
  //     batch.update(docRef, { is_setting_lineups: false });
  //   }
  // }

  // check each team from firestore and delete it from firestore if it isn't in Yahoo
  for (const eTeam of existingTeams) {
    if (!yahooTeams.some((yTeam) => yTeam.team_key === eTeam)) {
      console.log("Deleting team from batch: " + eTeam);
      const docRef = db.collection("users/" + uid + "/teams").doc(eTeam);
      batch.delete(docRef);
    }
  }

  await batch.commit();
});
