import { firestore } from "firebase-admin";
import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { ReturnCredential, Token } from "../../interfaces/credential";
import {
  clientToFirestore,
  TeamClient,
  TeamFirestore,
} from "../../interfaces/Team";
import { sendUserEmail } from "../email.service";
import { refreshYahooAccessToken } from "../yahooAPI/yahooAPI.service";
import { revokeRefreshToken } from "./revokeRefreshToken.service";

export const db = firestore();

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
    throw new Error(`No access token found for user ${uid}`);
  }

  // return the current token if it is valid, or refresh the token if not
  let credential: ReturnCredential;
  // add 10 seconds to the expiration time to account for latency
  if (docData.tokenExpirationTime < Date.now() + 10000) {
    let token: Token;
    try {
      token = await refreshYahooAccessToken(docData.refreshToken);
    } catch (error) {
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
      logger.error(`Error refreshing access token for user: ${uid}`, error);
      throw new Error(`Could not refresh access token for user: ${uid}`);
    }
    try {
      await db.collection("users").doc(uid).update(token);
    } catch (error) {
      logger.error(`Error storing token in Firestore for user: ${uid}`, error);
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
    // get all teams for the user that have not ended
    const teamsRef = db.collection(`users/${uid}/teams`);
    const teamsSnapshot = await teamsRef
      .where("end_date", ">=", Date.now())
      .get();

    return teamsSnapshot.docs.map(
      (doc) => ({ team_key: doc.id, ...doc.data() } as TeamFirestore)
    );
  } catch (error) {
    logger.error(`Error in fetchTeamsFirestore for User: ${uid}`, error);
    throw new Error(`Error fetching teams from Firebase. User: ${uid}`);
  }
}

/**
 * Fetches all teams from Firestore for the user that are actively setting
 * lineups
 *
 *
 * @export
 * @async
 * @param {string[]} leagues - The leagues to filter by
 * @return {unknown} - An array of teams from Firestore
 */
export async function getActiveTeamsForLeagues(leagues: string[]) {
  let result: QuerySnapshot<DocumentData>;

  try {
    const teamsRef = db.collectionGroup("teams");
    result = await teamsRef
      .where("is_setting_lineups", "==", true)
      .where("end_date", ">=", Date.now())
      .where("game_code", "in", leagues)
      .get();
  } catch (error) {
    return Promise.reject(error);
  }

  return result;
}

/**
 * Fetches all teams from Firestore for the user that are actively setting
 * lineups, allow transactions, and have a weekly deadline
 *
 * @export
 * @async
 * @return {unknown} - An array of teams from Firestore
 */
export async function getActiveWeeklyTeams() {
  let result: QuerySnapshot<DocumentData>;

  try {
    const teamsRef = db.collectionGroup("teams");
    result = await teamsRef
      .where("is_setting_lineups", "==", true)
      .where("allow_transactions", "==", true)
      .where("end_date", ">=", Date.now())
      .where("weekly_deadline", "==", "1")
      .get();
  } catch (error) {
    return Promise.reject(error);
  }

  return result;
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

  const collectionPath = `users/${uid}/teams`;
  for (const mTeam of missingTeams) {
    if (mTeam.end_date < Date.now()) continue;

    mTeam.uid = uid; // uid is not present in TeamClient
    const data: TeamFirestore = clientToFirestore(mTeam);

    const docId = String(mTeam.team_key);
    const docRef = db.collection(collectionPath).doc(docId);
    batch.set(docRef, data);
  }

  for (const eTeam of extraTeams) {
    const docId = String(eTeam.team_key);
    const docRef = db.collection(collectionPath).doc(docId);
    batch.delete(docRef);
  }
  try {
    await batch.commit();
  } catch (error) {
    logger.error(`Error in syncTeamsInFirebase for User: ${uid}`, error);
    logger.info("missingTeams: ", missingTeams);
    logger.info("extraTeams: ", extraTeams);
    throw new Error("Error syncing teams in Firebase.");
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
  const teamRef = db.collection(`users/${uid}/teams`).doc(teamKey);
  try {
    await teamRef.update({
      last_updated: Date.now(),
    });
  } catch (error) {
    logger.error(
      `Error in updateFirestoreTimestamp for User: ${uid} and team: ${teamKey}`,
      error
    );
  }
}
