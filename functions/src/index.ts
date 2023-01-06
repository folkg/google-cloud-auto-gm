import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
const fetch = require("node-fetch"); // for compatibility with firebase
import {
  AuthEventContext,
  AuthUserRecord,
} from "firebase-functions/lib/common/providers/identity";
import {CallableContext} from "firebase-functions/lib/common/providers/https";
import {
  ReturnCredential,
  YahooCredential,
  YahooRefreshRequestBody,
} from "./credential";

admin.initializeApp();

exports.beforeSignIn = functions.auth
    .user()
    .beforeSignIn((user: AuthUserRecord, context: AuthEventContext) => {
    // If the user is created by Yahoo, save the access token and refresh token
      if (context.credential?.providerId === "yahoo.com") {
        const db = admin.firestore();

        const uid = user.uid;
        const data = {
          accessToken: context.credential.accessToken,
          refreshToken: context.credential.refreshToken,
          tokenExpirationTime: Date.parse(
          context.credential.expirationTime as string
          ),
        };

        // set will add or overwrite the data
        db.collection("users").doc(uid).set(data);
      }
    });

exports.getAccessToken = functions.https.onCall(
    async (data, context: CallableContext) => {
      const db = admin.firestore();

      const uid = context.auth?.uid;
      if (!uid) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to get an access token"
        );
      }

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
        console.log("Token has expired, refreshing token.");
        credential = await refreshYahooAccessToken(uid, docData.refreshToken);
      } else {
        console.log("Token is still valid, returning current token.");

        credential = {
          accessToken: docData.accessToken,
          tokenExpirationTime: docData.tokenExpirationTime,
        };
      }
      return credential;
    }
);

/**
 * @param {string} uid The firebase uid
 * @param {string} refreshToken The refresh token
 * @return {Promise<ReturnCredential>} The new credential
 */
async function refreshYahooAccessToken(
    uid: string,
    refreshToken: string
): Promise<ReturnCredential> {
  const db = admin.firestore();

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

  const response = await fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });
  const results: YahooCredential = (await response.json()) as YahooCredential;

  // Get the token info from the response and save it to the database
  const accessToken = results.access_token;
  const tokenExpirationTime = results.expires_in * 1000 + Date.now();
  const data = {
    accessToken: accessToken,
    refreshToken: results.refresh_token,
    tokenExpirationTime: tokenExpirationTime,
  };

  // set will add or overwrite the data
  await db.collection("users").doc(uid).set(data);

  // return the credential from the function (without the refresh token)
  const credential: ReturnCredential = {
    accessToken: accessToken,
    tokenExpirationTime: tokenExpirationTime,
  };

  return credential;
}
