import * as admin from "firebase-admin";

const authBlockingFunctions = require("./authBlockingFunctions");
exports.beforeSignIn = authBlockingFunctions.beforeSignIn;

const yahooGetAccessToken = require("./yahooGetAccessToken");
exports.getAccessToken = yahooGetAccessToken.getAccessToken;

admin.initializeApp();
