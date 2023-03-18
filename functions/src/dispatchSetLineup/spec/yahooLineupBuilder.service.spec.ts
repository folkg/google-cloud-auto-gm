import { fetchRostersFromYahoo } from "../services/yahooLineupBuilder.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// mock the result from yahooAPI getRostersByTeamID()
const yahooAPIService = require("../../common/services/yahooAPI/yahooAPI.service");
jest.mock("../../common/services/yahooAPI/yahooAPI.service");

describe("Test fetchRostersFromYahoo", function () {
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
    expect(result).toEqual(expected);
  });
});
