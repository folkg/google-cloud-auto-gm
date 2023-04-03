import { logger } from "firebase-functions";
import * as functionsV1 from "firebase-functions/v1";
import { db } from "../common/services/firebase/firestore.service";
import { FirestoreUser } from "./interfaces/FirestoreUser";

export const beforeSignInV1 = functionsV1.auth
  .user()
  .beforeSignIn(async (user, context) => {
    const credential = context.credential;
    if (credential) {
      const uid = user.uid;
      const data: FirestoreUser = {
        accessToken: credential.accessToken ?? "",
        refreshToken: credential.refreshToken ?? "",
        tokenExpirationTime: Date.parse(credential.expirationTime as string),
        freeTrialExpirationTime: -1,
        subscriptionExpirationTime: -1,
      };

      try {
        await db.collection("users").doc(uid).set(data);
      } catch (error) {
        logger.error(
          `Error saving login token credentials in Firestore for user ${uid}`,
          error
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
