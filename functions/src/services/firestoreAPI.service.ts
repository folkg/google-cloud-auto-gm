import {
  clientToFirestore,
  TeamClient,
  TeamFirestore,
} from "../interfaces/team";
import * as admin from "firebase-admin";
const db = admin.firestore();

/**
 * Fetches all teams from Firestore for the user
 *
 * @export
 * @param {string} uid - The user id
 * @return {Promise<TeamFirestore[]>} - An array of teams
 */
export async function fetchTeamsFirestore(
  uid: string
): Promise<TeamFirestore[]> {
  try {
    const teams: TeamFirestore[] = [];
    // get all teams for the user that have not ended
    const teamsRef = db.collection("users/" + uid + "/teams");
    const teamsSnapshot = await teamsRef
      .where("end_date", ">=", Date.now())
      .get();

    teamsSnapshot.forEach((doc) => {
      teams.push({ team_key: doc.id, ...doc.data() } as TeamFirestore);
    });
    return teams;
  } catch (err: Error | any) {
    throw new Error("Error fetching teams from Firebase. " + err.message);
  }
}

/**
 * Syncs the teams in Firestore to match the teams in Yahoo
 *
 * @export
 * @async
 * @param {TeamClient[]} yahooTeams - The missing  teams from Yahoo
 * @param {string} uid - The user id
 * @param {TeamFirestore[]} firestoreTeams - The teams from Firestore
 */
export async function syncTeamsInFirebase(
  yahooTeams: TeamClient[],
  uid: string,
  firestoreTeams: TeamFirestore[]
) {
  const batch = db.batch();

  // find all teams that are in yahoo (w/ active season) but not in firestore
  const missingTeams: TeamClient[] = yahooTeams.filter(
    (t) =>
      t.end_date > Date.now() &&
      !firestoreTeams.some((f) => f.team_key === t.team_key)
  );
  console.log("Missing teams: " + missingTeams.length);

  for (const mTeam of missingTeams) {
    console.log("Adding team to batch: " + mTeam.team_key);
    mTeam.uid = uid; // uid is not present in TeamClient
    const data: TeamFirestore = clientToFirestore(mTeam);
    console.log("Data: " + JSON.stringify(data));

    const docId = String(mTeam.team_key);
    const docRef = db.collection("users/" + uid + "/teams").doc(docId);
    batch.set(docRef, data);
  }

  // find all teams that are in firestore but not in yahoo
  const extraTeams = firestoreTeams.filter(
    (t) => !yahooTeams.some((y) => y.team_key === t.team_key)
  );
  console.log("Extra teams: " + extraTeams.length);

  for (const eTeam of extraTeams) {
    console.log("Deleting team from batch: " + eTeam.team_key);
    const docId = String(eTeam.team_key);
    const docRef = db.collection("users/" + uid + "/teams").doc(docId);
    batch.delete(docRef);
  }
  try {
    await batch.commit();
  } catch (err: Error | any) {
    throw new Error("Error syncing teams in Firebase. " + err.message);
  }
}

/**
 * Update the last_updated timestamp in Firestore
 *
 * @async
 * @param {string} uid The firebase uid
 * @param {string} teamKey The team key
 */
export async function updateFirestoreTimestamp(uid: string, teamKey: string) {
  const teamRef = db.collection("users/" + uid + "/teams").doc(teamKey);
  await teamRef.update({
    last_updated: Date.now(),
  });
}
