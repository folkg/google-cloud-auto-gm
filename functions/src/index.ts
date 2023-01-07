import * as admin from "firebase-admin";

const authBlockingFunctions = require("./authBlockingFunctions");
exports.beforeSignIn = authBlockingFunctions.beforeSignIn;
exports.beforeCreate = authBlockingFunctions.beforeCreate;

const yahooGetAccessToken = require("./yahooGetAccessToken");
exports.getAccessToken = yahooGetAccessToken.getAccessToken;

const yahooRefreshTeams = require("./yahooRefreshTeams");
exports.refreshTeams = yahooRefreshTeams.refreshTeams;

admin.initializeApp();
