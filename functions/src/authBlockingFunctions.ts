import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";

export const beforeCreateV1 = functionsV1.auth
  .user()
  .beforeCreate((user, context) => {
    const credential = context.credential;
    if (credential) {
      const db = admin.firestore();
      const uid = user.uid;
      const data = {
        accessToken: credential.accessToken,
        refreshToken: credential.refreshToken,
        tokenExpirationTime: Date.parse(credential.expirationTime as string),
      };

      db.collection("users").doc(uid).set(data);
    }
  });

// import { beforeUserCreated } from "firebase-functions/v2/identity";

// export const beforecreate = beforeUserCreated((event) => {
//   const credential = event.credential;
//   if (credential) {
//     const db = admin.firestore();
//     const uid = event.data.uid;
//     const data = {
//       accessToken: credential.accessToken,
//       refreshToken: credential.refreshToken,
//       tokenExpirationTime: Date.parse(credential.expirationTime as string),
//     };

//     db.collection("users").doc(uid).set(data);
//   }
// });
