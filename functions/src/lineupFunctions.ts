import { fetchuserteams } from "./fetchUsersTeams/fetchUsersTeams.js";
import { schedulesetlineup } from "./scheduleSetLineup/scheduleSetLineup.js";
import { scheduleweeklyleaguetransactions } from "./scheduleSetLineup/scheduleWeeklyLeagueTansactions.js";
import { dispatchsetlineup } from "./dispatchSetLineup/dispatchSetLineup.js";
import { dispatchweeklyleaguetransactions } from "./dispatchSetLineup/dispatchWeeklyLeagueTansactions.js";
import { addmocktaskstoqueue } from "./mockScheduleDispatch/addMockTasksToQueue.js";
import { mockdispatchsetlineup } from "./mockScheduleDispatch/mockDispatchSetLineup.js";

export {
  fetchuserteams,
  schedulesetlineup,
  scheduleweeklyleaguetransactions,
  dispatchsetlineup,
  dispatchweeklyleaguetransactions,
  addmocktaskstoqueue,
  mockdispatchsetlineup,
};

// TODO: This is just for testing. Remove later.
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { setUsersLineup } from "./dispatchSetLineup/services/setLineups.service.js";
export const testsetlineups = onRequest(async (_req, res) => {
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
    // { team_key: "422.l.115494.t.4", game_code: "mlb" },
    // { team_key: "422.l.119198.t.3", game_code: "mlb" },
    // { team_key: "422.l.16955.t.10", game_code: "mlb" },
    // { team_key: "422.l.17808.t.2", game_code: "mlb" },
    // { team_key: "422.l.34143.t.10", game_code: "mlb" },
    { team_key: "422.l.58716.t.20", game_code: "mlb" },
    // { team_key: "422.l.67019.t.4", game_code: "mlb" },
    // { team_key: "422.l.90351.t.2", game_code: "mlb", allow_dropping: true },
  ];
  // Jeff Barnes

  const firestoreTeams = teams.map((team) => ({
    uid,
    team_key: team.team_key,
    game_code: team.game_code,
    is_subscribed: true,
    is_setting_lineups: true,
    last_updated: Date.now(),
    allow_transactions: true,
    allow_dropping: true,
    allow_adding: true,
    allow_add_drops: true,
    allow_waiver_adds: true,
    start_date: 1,
    end_date: Number.MAX_SAFE_INTEGER,
    weekly_deadline: "2021-04-01",
  }));

  try {
    return await setUsersLineup(uid, firestoreTeams);
  } catch (error) {
    logger.log("Error in testsetlineups: ", error);
  }
  res.end();
});
