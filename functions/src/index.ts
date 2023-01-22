import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

const authBlockingFunctions = require("./authBlockingFunctions");
exports.beforecreate = authBlockingFunctions.beforecreate;

const yahooGetAccessToken = require("./yahooGetAccessToken");
exports.getaccesstoken = yahooGetAccessToken.getaccesstoken;

const yahooRefreshTeams = require("./yahooRefreshTeams");
exports.refreshteams = yahooRefreshTeams.refreshteams;

const scheduleSetLineup = require("./scheduleSetLineup");
exports.schedulesetlineup = scheduleSetLineup.schedulesetlineup;

const yahooSetLineups = require("./yahooSetLineups");
exports.dispatchsetlineup = yahooSetLineups.dispatchsetlineup;

// TODO: This is just for testing. Remove later.
import { setUsersLineup } from "./services/yahooLineupOptimizer.service";
exports.testsetlineups = onRequest(async (req, res) => {
  // const uid = "ViGHQOGjhrhbTthiUgsdSIc3Im93"; // Graeme Folk
  const uid = "pc7r4y8i2XZotB6Wqc2jAEYYl9i1"; // Jeff Barnes
  // const teams = [
  //   // "414.l.240994.t.12",
  //   "414.l.358976.t.4",
  //   "419.l.14950.t.2",
  //   // "419.l.19947.t.6",
  //   // "419.l.28340.t.1",
  //   // "419.l.59985.t.12",
  // ]; // Graeme Folk
  const teams = ["414.l.358976.t.4", "419.l.91560.t.5", "419.l.91564.t.11"]; // Jeff Barnes
  return await setUsersLineup(uid, teams);
});

admin.initializeApp();
