import * as admin from "firebase-admin";
import { beforeUserCreated } from "firebase-functions/v2/identity";

export const beforecreate = beforeUserCreated((event) => {
  const credential = event.credential;
  if (credential) {
    const db = admin.firestore();
    const uid = event.data.uid;
    const data = {
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
      tokenExpirationTime: Date.parse(credential.expirationTime as string),
    };

    db.collection("users").doc(uid).set(data);
  }
});
