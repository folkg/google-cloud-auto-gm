import { HttpsError, onCall } from "firebase-functions/v2/https";
import { loadYahooAccessToken } from "./services/yahooAPI.service";

export const getaccesstoken = onCall((request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }
  return loadYahooAccessToken(uid);
});
