import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  AuthEventContext,
  AuthUserRecord,
} from "firebase-functions/lib/common/providers/identity";

exports.beforeCreate = functions.auth.user().beforeCreate((user, context) => {
  //TODO: call the function to get all user teams from Yahoo and add to DB
  //set emailVerified to false when signing up with Yahoo, forcing the user to verify their email
  if (context.credential?.providerId === "yahoo.com") {
    return {
      emailVerified: false,
    };
  }
  return {};
});

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
