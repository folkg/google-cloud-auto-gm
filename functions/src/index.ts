import * as admin from "firebase-admin";

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

admin.initializeApp();
