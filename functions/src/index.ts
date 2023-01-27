import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

admin.initializeApp();

const authBlockingFunctions = require("./authBlockingFunctions");
// exports.beforecreate = authBlockingFunctions.beforecreate;
exports.beforeCreateV1 = authBlockingFunctions.beforeCreateV1;

const fetchUserTeams = require("./fetchUsersTeams");
exports.fetchuserteams = fetchUserTeams.fetchuserteams;

const scheduleSetLineup = require("./scheduleSetLineup");
exports.schedulesetlineup = scheduleSetLineup.schedulesetlineup;

const yahooSetLineups = require("./yahooSetLineups");
exports.dispatchsetlineup = yahooSetLineups.dispatchsetlineup;

const sendFeedbackEmail = require("./sendFeedbackEmail");
exports.sendfeedbackemail = sendFeedbackEmail.sendfeedbackemail;

// TODO: This is just for testing. Remove later.
import { setUsersLineup } from "./services/yahooLineupOptimizer.service";
exports.testsetlineups = onRequest(async (req, res) => {
  const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1"; // Graeme Folk
  // const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes
  const teams = [
    // "414.l.240994.t.12",
    // "414.l.358976.t.4",
    // "419.l.14950.t.2",
    "419.l.19947.t.6",
    // "419.l.28340.t.1",
    // "419.l.59985.t.12",
  ]; // Graeme Folk
  // const teams = [
  //   "414.l.358976.t.4",
  //   "419.l.91560.t.5",
  //   "419.l.91564.t.11",
  //   "418.l.201581.t.1",
  //   "418.l.200641.t.9",
  // ]; // Jeff Barnes
  return await setUsersLineup(uid, teams);
});
