import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { CallableContext } from "firebase-functions/lib/common/providers/https";

import {
  ReturnCredential,
  YahooCredential,
  YahooRefreshRequestBody,
} from "./interfaces/credential";
import { httpPostAxios } from "./services/yahooHttp.service";
import { AxiosError } from "axios";

exports.getAccessToken = functions.https.onCall(
  async (data, context: CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to get an access token"
      );
    }
    return loadYahooAccessToken(uid);
  }
);

// TODO: move these functions into different yahooAPI service?
// TODO: Ensure this post request is working with axios
/**
 * Load the access token from DB, or refresh from Yahoo if expired
 * @param {(string)} uid The firebase uid
 * @return {Promise<ReturnCredential>} The credential with token and expiry
 */
export async function loadYahooAccessToken(
  uid: string
): Promise<ReturnCredential> {
  const db = admin.firestore();

  // fetch the current token from the database
  const doc = await db.collection("users").doc(uid).get();
  const docData = doc.data();
  if (!doc.exists || !docData) {
    throw new functions.https.HttpsError(
      "not-found",
      "No access token found for user"
    );
  }

  // return the current token if it is valid, or refresh the token if not
  let credential: ReturnCredential;
  if (docData.tokenExpirationTime <= Date.now()) {
    // console.log("Token has expired, refreshing token.");
    credential = await refreshYahooAccessToken(uid, docData.refreshToken);
  } else {
    // console.log("Token is still valid, returning current token.");
    credential = {
      accessToken: docData.accessToken,
      tokenExpirationTime: docData.tokenExpirationTime,
    };
  }
  return credential;
}

/**
 * Refresh the Yahoo access token for the given user
 * @param {string} uid The firebase uid
 * @param {string} refreshToken The refresh token
 * @return {Promise<ReturnCredential>} The new credential
 */
async function refreshYahooAccessToken(
  uid: string,
  refreshToken: string
): Promise<ReturnCredential> {
  const db = admin.firestore();
  let credential: ReturnCredential = {
    accessToken: "",
    tokenExpirationTime: -1,
  };

  const url = "https://api.login.yahoo.com/oauth2/get_token";
  const requestBody: YahooRefreshRequestBody = {
    client_id: process.env.YAHOO_CLIENT_ID as string,
    client_secret: process.env.YAHOO_CLIENT_SECRET as string,
    redirect_uri: process.env.YAHOO_REDIRECT_URI as string,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };
  const body = Object.keys(requestBody)
    .map(
      (key) =>
        encodeURIComponent(key) +
        "=" +
        encodeURIComponent(requestBody[key as keyof YahooRefreshRequestBody])
    )
    .join("&");

  let results: YahooCredential;
  try {
    const { data } = await httpPostAxios(url, body);
    results = data as YahooCredential;
    // Get the token info from the response and save it to the database
    const accessToken = results.access_token;
    const tokenExpirationTime = results.expires_in * 1000 + Date.now();
    const token = {
      accessToken: accessToken,
      refreshToken: results.refresh_token,
      tokenExpirationTime: tokenExpirationTime,
    };

    // set will add or overwrite the data
    await db.collection("users").doc(uid).update(token);

    // return the credential from the function (without the refresh token)
    credential = {
      accessToken: accessToken,
      tokenExpirationTime: tokenExpirationTime,
    };
  } catch (error: AxiosError | any) {
    console.log("Error fetching token from Yahoo API");
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
      throw new functions.https.HttpsError(
        "internal",
        "Communication with Yahoo failed: " + error.response.data
      );
    }
  }
  return credential;
}
