import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const authBlockingFunctions = require("./authBlockingFunctions");
exports.beforeCreate = authBlockingFunctions.beforeCreate;

const yahooGetAccessToken = require("./yahooGetAccessToken");
exports.getAccessToken = yahooGetAccessToken.getAccessToken;

const yahooRefreshTeams = require("./yahooRefreshTeams");
exports.refreshTeams = yahooRefreshTeams.refreshTeams;

const scheduleSetLineup = require("./scheduleSetLineup");
exports.scheduleSetLineup = scheduleSetLineup.scheduleSetLineup;

const yahooSetLineups = require("./yahooSetLineups");
exports.dispatchSetLineupTask = yahooSetLineups.dispatchSetLineupTask;

// TODO: This is just for testing. Remove later.
import { setUsersLineup } from "./services/yahooLineupOptimizer.service";
exports.testSetLineups = functions.https.onRequest(async (data, context) => {
  const uid = "6IK2AFpBWidMWYDAKtDiLHbwOhq2";
  const teams = [
    "414.l.240994.t.12",
    "414.l.358976.t.4",
    "419.l.14950.t.2",
    "419.l.19947.t.6",
    "419.l.28340.t.1",
    "419.l.59985.t.12",
  ];
  await setUsersLineup(uid, teams);
});

admin.initializeApp();
