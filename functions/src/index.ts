import { initializeApp } from "firebase-admin/app";
initializeApp();

exports.authBlock = require("./authBlockingFunctions");
exports.email = require("./emailFunctions");
exports.lineup = require("./lineupFunctions");
