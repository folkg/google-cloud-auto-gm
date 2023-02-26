import {
  clientToFirestore,
  TeamClient,
  TeamFirestore,
} from "../interfaces/team";
import * as admin from "firebase-admin";
import { ReturnCredential, Token } from "../interfaces/credential";
import { refreshYahooAccessToken } from "./yahooAPI.service";
import { sendUserEmail } from "./email.service";
import { revokeRefreshToken } from "./revokeRefreshToken.service";
import { error } from "firebase-functions/logger";

export const db = admin.firestore();

/**
 * Load the access token from DB, or refresh from Yahoo if expired
 * @param {(string)} uid The firebase uid
 * @return {Promise<ReturnCredential>} The credential with token and expiry
 */
export async function loadYahooAccessToken(
  uid: string
): Promise<ReturnCredential> {
  // fetch the current token from the database
  const doc = await db.collection("users").doc(uid).get();
  const docData = doc.data();
  if (!doc.exists || !docData) {
    throw new Error("No access token found for user");
  }

  // return the current token if it is valid, or refresh the token if not
  let credential: ReturnCredential;
  // add 5 seconds to the expiration time to account for latency
  if (docData.tokenExpirationTime < Date.now() + 5000) {
    let token: Token;
    try {
      token = await refreshYahooAccessToken(docData.refreshToken);
    } catch (error: Error | any) {
      // Revoking the refresh token will force the user to re-authenticate with Yahoo
      // Send an email to the user to let them know
      revokeRefreshToken(uid);
      sendUserEmail(
        uid,
        "Fantasy AutoCoach: Yahoo Authentication Error",
        "You Yahoo access has expired and your lineups are not currently being set!\n" +
          "Please visit the Fantasy AutoCoach website and sign-in again to re-authenticate.\n" +
          "https://auto-gm-372620.web.app/"
      );
      throw new Error(
        "Could not refresh access token for user: " + uid + ". " + error.message
      );
    }
    try {
      await db.collection("users").doc(uid).update(token);
    } catch (error: Error | any) {
      error(
        "Error storing token in Firestore for user: " +
          uid +
          ". " +
          error.message
      );
    }

    credential = {
      accessToken: token.accessToken,
      tokenExpirationTime: token.tokenExpirationTime,
    };
  } else {
    credential = {
      accessToken: docData.accessToken,
      tokenExpirationTime: docData.tokenExpirationTime,
    };
  }
  return credential;
}

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
    error("Error in fetchTeamsFirestore for User: " + uid);
    throw new Error("Error fetching teams from Firebase. " + err.message);
  }
}

/**
 * Syncs teams in Firestore with teams from Yahoo
 *
 * @export
 * @async
 * @param {TeamClient[]} missingTeams - Teams that are in Yahoo but not in Firestore
 * @param {TeamFirestore[]} extraTeams - Teams that are in Firestore but not in Yahoo
 * @param {string} uid - The user id
 */
export async function syncTeamsInFirebase(
  missingTeams: TeamClient[],
  extraTeams: TeamFirestore[],
  uid: string
) {
  const batch = db.batch();

  for (const mTeam of missingTeams) {
    if (mTeam.end_date < Date.now()) continue;

    // console.log("Adding team to batch: " + mTeam.team_key);
    mTeam.uid = uid; // uid is not present in TeamClient
    const data: TeamFirestore = clientToFirestore(mTeam);

    const docId = String(mTeam.team_key);
    const docRef = db.collection("users/" + uid + "/teams").doc(docId);
    batch.set(docRef, data);
  }

  for (const eTeam of extraTeams) {
    // console.log("Deleting team from batch: " + eTeam.team_key);
    const docId = String(eTeam.team_key);
    const docRef = db.collection("users/" + uid + "/teams").doc(docId);
    batch.delete(docRef);
  }
  try {
    await batch.commit();
  } catch (err: Error | any) {
    error("Error in syncTeamsInFirebase for User: " + uid);
    console.log("missingTeams: " + JSON.stringify(missingTeams));
    console.log("extraTeams: " + JSON.stringify(extraTeams));
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
  try {
    await teamRef.update({
      last_updated: Date.now(),
    });
  } catch (err: Error | any) {
    error(
      "Error in updateFirestoreTimestamp updating last_updated timestamp in Firebase. " +
        err
    );
    error("uid: " + uid + ", teamKey: " + teamKey);
  }
}
