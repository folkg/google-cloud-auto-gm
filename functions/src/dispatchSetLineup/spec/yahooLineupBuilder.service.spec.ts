import { afterEach, describe, expect, test, vi } from "vitest";
import * as yahooAPIService from "../../common/services/yahooAPI/yahooAPI.service.js";
import { fetchRostersFromYahoo } from "../services/yahooLineupBuilder.service.js";

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
describe.concurrent("Test fetchRostersFromYahoo", function () {
  afterEach(() => {
    // restore the spy created with spyOn
    vi.restoreAllMocks();
  });

  test.only("Elite League roster", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/419.l.28340.t.1.json");
    const expected = require("./testYahooLineupJSON/output/419.l.28340.t.1.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual(expected);
  });

  test("Irish Lacrosse roster - weekly max pickups", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/419.l.19947.t.6.json");
    const expected = require("./testYahooLineupJSON/output/419.l.19947.t.6.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual(expected);
  });

  test("NBA Weekly League - not editable", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/NBAWeeklyNotEditable.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);

    expect(result).toEqual([]);
  });

  test("NBA Weekly League - editable", async function () {
    const teams = ["419.l.28340.t.1"];
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/NBAWeekly.json");
    const expected = require("./testYahooLineupJSON/output/NBAWeekly.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

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
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/dispatchSetLineup/spec/testYahooLineupJSON/output/2NHL&1NBA.json",
    //   JSON.stringify(result)
    // );

    expect(result).toEqual(expected);
  });

  test("MLB with pending waiver claim", async function () {
    const teams = ["422.l.115494.t.4"];
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/MLB.json");
    const expected = require("./testYahooLineupJSON/output/MLB.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/dispatchSetLineup/spec/testYahooLineupJSON/output/MLB.json",
    //   JSON.stringify(result)
    // );

    expect(result).toEqual(expected);
  });

  test("MLB with multiple pending transactions", async function () {
    const teams = ["test"];
    const uid = "test";
    const yahooJSON = require("./testYahooLineupJSON/yahooJSON/MLBpendingTransactions.json");
    const expected = require("./testYahooLineupJSON/output/MLBpendingTransactions.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/dispatchSetLineup/spec/testYahooLineupJSON/output/MLBpendingTransactions.json",
    //   JSON.stringify(result)
    // );

    expect(result).toEqual(expected);
  });

  test.skip("lazy utility to convert a JSON to an ITeam", async function () {
    const teams = ["test"];
    const uid = "test";
    const yahooJSON = require("?");
    // const expected = require("./testYahooLineupJSON/output/MLBpendingTransactions.json");

    // mock the JSON result from yahooAPI getRostersByTeamID()
    vi.spyOn(yahooAPIService, "getRostersByTeamID").mockReturnValue(yahooJSON);

    const result = await fetchRostersFromYahoo(teams, uid);
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/dispatchSetLineup/spec/testRosters/MLB/userRequest_2.json",
    //   JSON.stringify(result)
    // );
    expect(result).toBeDefined();
  });
});
