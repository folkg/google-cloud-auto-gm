import { describe, expect, test, vi } from "vitest";
import * as yahooAPIService from "../../common/services/yahooAPI/yahooAPI.service.js";
import { fetchTopAvailablePlayersFromYahoo } from "../services/yahooTopAvailablePlayersBuilder.service.js";

// mock firebase-admin
vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn(),
  };
});
vi.mock("firebase-admin/app", () => {
  return {
    getApps: vi.fn(() => ["null"]),
    initializeApp: vi.fn(),
  };
});

// To mock the result from yahooAPI getRostersByTeamID()
describe("Test fetchRostersFromYahoo", function () {
  test("Test Players", async function () {
    const teamKeys = ["422.l.90351.t.1"];
    const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2";
    const yahooJSON = require("./testYahooPlayersJSON/yahooJSON/free-agents.json");

    vi.spyOn(yahooAPIService, "getTopAvailablePlayers").mockReturnValue(
      yahooJSON
    );

    const result = await fetchTopAvailablePlayersFromYahoo(teamKeys, uid);

    expect(result).toMatchSnapshot();
  });

  test("With waivers and freeagents", async function () {
    const teamKeys = ["422.l.115494.t.4", "422.l.16955.t.10"];
    const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2";
    const yahooJSON = require("./testYahooPlayersJSON/yahooJSON/yahooJSONWaivers.json");

    vi.spyOn(yahooAPIService, "getTopAvailablePlayers").mockReturnValue(
      yahooJSON
    );

    const result = await fetchTopAvailablePlayersFromYahoo(teamKeys, uid);

    expect(result).toMatchSnapshot();
  });
});
