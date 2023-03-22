import { LineupOptimizer } from "../classes/LineupOptimizer";
import { fetchRostersFromYahoo } from "../services/yahooLineupBuilder.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// To mock the result from yahooAPI getRostersByTeamID()
const yahooAPIService = require("../../common/services/yahooAPI/yahooAPI.service");

describe("Test fetchRostersFromYahoo", function () {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  test("Elite League roster", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/419.l.28340.t.1.json");
    const expected = require("./testYahooLineupJSON/output/419.l.28340.t.1.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    jest
      .spyOn(yahooAPIService, "getRostersByTeamID")
      .mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    new LineupOptimizer(result[0]); // testing the constructor to see player ownership scores
    expect(result).toEqual(expected);
  });

  test("Irish Lacrosse roster - weekly max pickups", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/419.l.19947.t.6.json");
    const expected = require("./testYahooLineupJSON/output/419.l.19947.t.6.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    jest
      .spyOn(yahooAPIService, "getRostersByTeamID")
      .mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual(expected);
  });

  test("NBA Weekly League - not editable", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/NBAWeeklyNotEditable.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    jest
      .spyOn(yahooAPIService, "getRostersByTeamID")
      .mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual([]);
  });

  test("NBA Weekly League - editable", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/NBAWeekly.json");
    const expected = require("./testYahooLineupJSON/output/NBAWeekly.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    jest
      .spyOn(yahooAPIService, "getRostersByTeamID")
      .mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual(expected);
  });

  test("Two NHL, two NBA for Jeff Barnes", async function () {
    const teams = [
      "419.l.91560.t.5",
      "419.l.91564.t.11",
      "418.l.201581.t.1",
      "418.l.200641.t.9",
    ]; // Jeff Barnes
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/2NHL&1NBA.json");
    const expected = require("./testYahooLineupJSON/output/2NHL&1NBA.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    jest
      .spyOn(yahooAPIService, "getRostersByTeamID")
      .mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual(expected);
  });
});
