import { firestore } from "firebase-admin";
import {
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  TeamAngular,
  TeamFirestore,
  yahooToFirestore,
} from "../../interfaces/ITeam";
import { ReturnCredential, Token } from "../../interfaces/credential";
import { sendUserEmail } from "../email/email.service";
import {
  getCurrentPacificNumDay,
  getPacificTimeDateString,
} from "../utilities.service";
import { refreshYahooAccessToken } from "../yahooAPI/yahooAPI.service";
import { fetchStartingPlayers } from "../yahooAPI/yahooStartingPlayer.service";
import { revokeRefreshToken } from "./revokeRefreshToken.service";
import { AxiosError } from "axios";
import { RevokedRefreshTokenError } from "./errors";

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
  if (docData.refreshToken === "-1") {
    throw new RevokedRefreshTokenError(
      `User ${uid} has revoked access. Stopping all actions for this user.`
    );
  }

  // return the current token if it is valid, or refresh the token if not
  let credential: ReturnCredential;
  // add 10 seconds to the expiration time to account for latency
  if (docData.tokenExpirationTime < Date.now() + 10000) {
    let token: Token;
    try {
      token = await refreshYahooAccessToken(docData.refreshToken);
    } catch (error: AxiosError | any) {
      const errorRespose = error.response;
      if (
        errorRespose?.data?.error === "invalid_grant" &&
        errorRespose?.data?.error_description === "Invalid refresh token"
      ) {
        // Revoking the refresh token will force the user to re-authenticate with Yahoo
        // Send an email to the user to let them know that their access has expired
        await revokeRefreshToken(uid);
        await sendUserEmail(
          uid,
          "Urgent Action Required: Yahoo Authentication Error",
          [
            "<strong>Your Yahoo access has expired and your lineups are no longer being managed by Fantasy AutoCoach.</strong>",
            "Please visit the Fantasy AutoCoach website below and sign in again with Yahoo so that we can continue to " +
              "manage your teams. Once you sign in, you will be re-directed to your dashabord and we " +
              "will have everything we need to continue managing your teams. Thank you for your assistance, and we " +
              "apologize for the inconvenience.",
          ],
          "Sign In",
          "https://fantasyautocoach.com/"
        );
      }
      logger.error(`Error refreshing access token for user: ${uid}`, error);
      throw new Error(`Could not refresh access token for user: ${uid}`);
    }
    try {
      await db
        .collection("users")
        .doc(uid)
        .update({ ...token });
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
 * Set the refresh token to sentinel value in the database for the specified user
 *
 * @export
 * @async
 * @param {string} uid - The user id
 * @return {*} - Nothing
 */
export async function flagRefreshToken(uid: string) {
  try {
    await db.collection("users").doc(uid).update({ refreshToken: "-1" });
  } catch (error) {
    logger.error(`Error setting refresh token to null for user: ${uid}`, error);
  }
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
      .where("weekly_deadline", "in", [
        "",
        "intraday",
        getCurrentPacificNumDay().toString(),
      ])
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
export async function getTomorrowsActiveWeeklyTeams() {
  let result: QuerySnapshot<DocumentData>;

  try {
    const teamsRef = db.collectionGroup("teams");
    result = await teamsRef
      .where("is_setting_lineups", "==", true)
      .where("allow_transactions", "==", true)
      .where("end_date", ">=", Date.now())
      .where(
        "weekly_deadline",
        "==",
        (getCurrentPacificNumDay() + 1).toString()
      )
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
 * @param {TeamAngular[]} missingTeams - Teams that are in Yahoo but not in Firestore
 * @param {TeamFirestore[]} extraTeams - Teams that are in Firestore but not in Yahoo
 * @param {string} uid - The user id
 */
export async function syncTeamsInFirebase(
  missingTeams: TeamAngular[],
  extraTeams: TeamFirestore[],
  uid: string
) {
  const batch = db.batch();

  const collectionPath = `users/${uid}/teams`;
  for (const mTeam of missingTeams) {
    if (mTeam.end_date < Date.now()) continue;

    mTeam.uid = uid; // uid is not present in TeamAngular
    const data: TeamFirestore = yahooToFirestore(mTeam);

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

export async function updateTeamFirestore(
  uid: string,
  teamKey: string,
  data: Partial<TeamFirestore>
) {
  const teamRef = db.collection(`users/${uid}/teams`).doc(teamKey);
  try {
    await teamRef.update(data);
    logger.info(`Updated team ${teamKey} for user ${uid} in Firestore`);
  } catch (error) {
    logger.error(
      `Error in updateTeamFirestore for User: ${uid} and team: ${teamKey}`,
      error
    );
  }
}

/**
 *
 * @async
 * @param {string} league The league code
 * @return {Promise<QuerySnapshot<DocumentData>>} the team
 */
export async function getIntradayTeams(
  league: string
): Promise<QuerySnapshot<DocumentData>> {
  const teamsRef = db.collectionGroup("teams");
  try {
    const teamsSnapshot = await teamsRef
      .where("game_code", "==", league)
      .where("end_date", ">=", Date.now())
      .where("weekly_deadline", "==", "intraday")
      .get();
    return teamsSnapshot;
  } catch (error) {
    logger.error(
      `Error fetching Intraday ${league.toUpperCase()} teams from firestore`,
      error
    );
    throw new Error(
      `Error fetching Intraday ${league.toUpperCase()} teams from firestore`
    );
  }
}

/**
 * Stores today's starting players in Firestore.
 * This would be used for goalies in the NHL and pitchers in MLB
 *
 * @export
 * @async
 * @param {string[]} startingPlayers - the starting players
 * @param {string} league - the league
 * @return {Promise<void>}
 */
export async function storeStartingPlayersInFirestore(
  startingPlayers: string[],
  league: string
): Promise<void> {
  const startingPlayersRef = db.collection("startingPlayers");
  try {
    await startingPlayersRef.doc(league).set({
      startingPlayers,
      date: getPacificTimeDateString(new Date()),
    });
  } catch (error) {
    logger.error(
      `Error storing starting ${league.toUpperCase()} players in Firestore`,
      error
    );
    throw new Error(
      `Error storing starting ${league.toUpperCase()} players in Firestore`
    );
  }
}

/**
 * Gets today's starting players from Firestore.
 * This would be used for goalies in the NHL and pitchers in MLB
 *
 * @export
 * @async
 * @param {string} league - the league
 * @return {Promise<string[]>} - the starting players
 */
export async function getStartingPlayersFromFirestore(
  league: string
): Promise<string[]> {
  const startingPlayersRef = db.collection("startingPlayers");
  try {
    const startingPlayersSnapshot: DocumentSnapshot<DocumentData> =
      await startingPlayersRef.doc(league).get();

    if (startingPlayersSnapshot.exists) {
      // check if the starting players were updated today
      const date: string = startingPlayersSnapshot.data()?.date;
      const today = getPacificTimeDateString(new Date());

      if (date === today) {
        return startingPlayersSnapshot.data()?.startingPlayers;
      }
    }
    // if the starting players were not updated today,
    // or don't exist in firebase, fetch them from Yahoo API
    console.log("Starting players not found in Firestore");
    try {
      await fetchStartingPlayers(league);
      return getStartingPlayersFromFirestore(league);
    } catch (error) {
      logger.error(error);
    }
  } catch (error) {
    logger.error(
      `Error getting starting ${league.toUpperCase()} players from Firestore`,
      error
    );
  }

  // return an empty array if there was an error
  // we can still proceed with the rest of the program
  return [];
}
