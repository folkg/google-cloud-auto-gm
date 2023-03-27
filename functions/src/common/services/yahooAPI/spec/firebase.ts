import * as firebaseAdmin from "firebase-admin";
const firebaseServiceAccountKey = require("../../../../../../auto-gm-372620-dd1695cac1a6.json");

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(firebaseServiceAccountKey),
});

console.log("Firebase Admin Initialized");
