import { error } from "firebase-functions/logger";
import * as functionsV1 from "firebase-functions/v1";
import { db } from "../common/services/firebase/firestore.service";

export const beforeSignInV1 = functionsV1.auth
  .user()
  .beforeSignIn(async (user, context) => {
    const credential = context.credential;
    if (credential) {
      const uid = user.uid;
      const data = {
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
        tokenExpirationTime: Date.parse(credential.expirationTime as string),
      };

      try {
        await db.collection("users").doc(uid).set(data);
      } catch (err: Error | any) {
        error(
          "Error saving login token credentials in Firestore for user " +
            uid +
            ". " +
            err.message
        );
      }
    }
  });

// import { beforeUserCreated } from "firebase-functions/v2/identity";

// export const beforecreate = beforeUserCreated((event) => {
//   const credential = event.credential;
//   if (credential) {
//     const uid = event.data.uid;
//     const data = {
//       accessToken: credential.accessToken,
//       refreshToken: credential.refreshToken,
//       tokenExpirationTime: Date.parse(credential.expirationTime as string),
//     };

//     db.collection("users").doc(uid).set(data);
//   }
// });