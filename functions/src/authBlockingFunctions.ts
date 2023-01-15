import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

exports.beforeCreate = functions.auth.user().beforeCreate((user, context) => {
  if (context.credential) {
    const db = admin.firestore();
    const credential = context.credential;
    const uid = user.uid;
    const data = {
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
      tokenExpirationTime: Date.parse(credential.expirationTime as string),
    };

    db.collection("users").doc(uid).set(data);
  }
});
