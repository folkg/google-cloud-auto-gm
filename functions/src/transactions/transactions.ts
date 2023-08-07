import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  getTransactions,
  postTransactions,
} from "./services/processTransactions.js";

export const getransactions = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }
  return await getTransactions(uid);
});

export const posttransactions = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }

  const { dropPlayerTransactions, lineupChanges, addSwapTransactions } =
    request.data.transactions;
  if (!dropPlayerTransactions || !lineupChanges || !addSwapTransactions) {
    throw new HttpsError(
      "invalid-argument",
      "You must provide dropPlayerTransactions, lineupChanges, and addSwapTransactions"
    );
  }

  return await postTransactions(
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
    uid
  );
});
