import * as firebaseAdmin from "firebase-admin";
import { logger } from "firebase-functions";

const firebaseServiceAccountKey = require("../../../../../../auto-gm-372620-dd1695cac1a6.json");

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(firebaseServiceAccountKey),
});

logger.log("Firebase Admin Initialized");
