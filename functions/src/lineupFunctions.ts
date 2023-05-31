import { fetchuserteams } from "./fetchUsersTeams/fetchUsersTeams";
exports.fetchuserteams = fetchuserteams;

import { schedulesetlineup } from "./scheduleSetLineup/scheduleSetLineup";
exports.schedulesetlineup = schedulesetlineup;
import { scheduleweeklyleaguetransactions } from "./scheduleSetLineup/scheduleWeeklyLeagueTansactions";
exports.scheduleweeklyleaguetransactions = scheduleweeklyleaguetransactions;

import { dispatchsetlineup } from "./dispatchSetLineup/dispatchSetLineup";
exports.dispatchsetlineup = dispatchsetlineup;
import { dispatchweeklyleaguetransactions } from "./dispatchSetLineup/dispatchWeeklyLeagueTansactions";
exports.dispatchweeklyleaguetransactions = dispatchweeklyleaguetransactions;

import { mockdispatchsetlineup } from "./mockScheduleDispatch/mockDispatchSetLineup";
exports.mockdispatchsetlineup = mockdispatchsetlineup;
import { addmocktaskstoqueue } from "./mockScheduleDispatch/addMockTasksToQueue";
exports.addmocktaskstoqueue = addmocktaskstoqueue;

// TODO: This is just for testing. Remove later.
import { onRequest } from "firebase-functions/v2/https";
import { setUsersLineup } from "./dispatchSetLineup/services/setLineups.service";
import { logger } from "firebase-functions";
exports.testsetlineups = onRequest(async (req, res) => {
  // const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1"; // Graeme Folk
  // const teams = [
  //   // { team_key: "414.l.240994.t.12" },
  //   // { team_key: "414.l.358976.t.4" },
  //   { team_key: "419.l.14950.t.2" },
  //   // { team_key: "419.l.19947.t.6" },
  //   // { team_key: "419.l.28340.t.1" },
  //   // { team_key: "419.l.59985.t.12" },
  // ]; // Graeme Folk

  const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2"; // Jeff Barnes
  const teams = [
    // { team_key: "414.l.358976.t.4", game_code: "nfl" },
    // { team_key: "419.l.91560.t.5", game_code: "nhl" },
    // { team_key: "419.l.91564.t.11", game_code: "nhl" },
    // { team_key: "418.l.201581.t.1", game_code: "nba" },
    // { team_key: "418.l.200641.t.9", game_code: "nba" },
    { team_key: "422.l.115494.t.4", game_code: "mlb" },
    // { team_key: "422.l.119198.t.3", game_code: "mlb" },
    // { team_key: "422.l.16955.t.10", game_code: "mlb" },
    // { team_key: "422.l.17808.t.2", game_code: "mlb" },
    // { team_key: "422.l.34143.t.10", game_code: "mlb" },
    // { team_key: "422.l.58716.t.20", game_code: "mlb" },
    // { team_key: "422.l.67019.t.4", game_code: "mlb" },
    // { team_key: "422.l.90351.t.2", game_code: "mlb", allow_dropping: true },
  ];
  // Jeff Barnes

  try {
    return await setUsersLineup(uid, teams);
  } catch (error) {
    logger.log("Error in testsetlineups: ", error);
  }
  res.end();
});
