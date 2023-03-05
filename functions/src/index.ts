import { initializeApp } from "firebase-admin/app";
initializeApp();

import { beforeSignInV1 } from "./authBlockingFunctions/authBlockingFunctions";
exports.beforeSignInV1 = beforeSignInV1;

import { fetchuserteams } from "./fetchUsersTeams/fetchUsersTeams";
exports.fetchuserteams = fetchuserteams;

import { schedulesetlineup } from "./scheduleSetLineup/scheduleSetLineup";
exports.schedulesetlineup = schedulesetlineup;

import { dispatchsetlineup } from "./dispatchSetLineup/dispatchSetLineup";
exports.dispatchsetlineup = dispatchsetlineup;

import { sendfeedbackemail } from "./sendEmail/sendEmail";
exports.sendfeedbackemail = sendfeedbackemail;

// TODO: This is just for testing. Remove later.
import { onRequest } from "firebase-functions/v2/https";
import { setUsersLineup2 } from "./dispatchSetLineup/services/newLineupOptimizer.service";
exports.testsetlineups = onRequest(async (req, res) => {
  const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1"; // Graeme Folk
  const teams = [
    // "414.l.240994.t.12",
    // "414.l.358976.t.4",
    // "419.l.14950.t.2",
    // "419.l.19947.t.6",
    "419.l.28340.t.1",
    // "419.l.59985.t.12",
  ]; // Graeme Folk

  // const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes
  // const teams = [
  //   "414.l.358976.t.4",
  //   "419.l.91560.t.5",
  //   "419.l.91564.t.11",
  //   "418.l.201581.t.1",
  //   "418.l.200641.t.9",
  // ]; // Jeff Barnes

  try {
    return await setUsersLineup2(uid, teams);
  } catch (error) {
    console.log("Error in testsetlineups: " + error);
  }
});
