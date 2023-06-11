import { describe, expect, test, vi } from "vitest";
import * as yahooAPIService from "../../common/services/yahooAPI/yahooAPI.service";
import { fetchTopAvailablePlayersFromYahoo } from "../services/yahooTopAvailablePlayersBuilder.service";

// mock firebase-admin
vi.mock("firebase-admin", () => ({
  initializeApp: vi.fn(),
  firestore: vi.fn(),
}));

// To mock the result from yahooAPI getRostersByTeamID()
describe("Test fetchRostersFromYahoo", function () {
  test("Test Players", async function () {
    const leagueKey = "422.l.90351";
    const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2";
    const yahooJSON = require("./testYahooPlayersJSON/yahooJSON/free-agents.json");
    const expected = require("./testYahooPlayersJSON/output/free-agents.json");

    vi.spyOn(yahooAPIService, "getTopAvailablePlayers").mockReturnValue(
      yahooJSON
    );

    const result = await fetchTopAvailablePlayersFromYahoo(leagueKey, uid);

    expect(result).toEqual(expected);
  });
});
