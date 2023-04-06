import { LineupOptimizer } from "../classes/LineupOptimizer";
import { ITeam } from "../interfaces/ITeam";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// Use this to mock the global NHL_STARTING_GOALIES array where needed
// const yahooStartingPlayerService = require("../../common/services/yahooAPI/yahooStartingPlayer.service");

describe("Test LineupOptimizer Class MLB Daily", function () {
  xtest("Already optimal roster", function () {
    const roster: ITeam = require("./testRosters/MLB/?");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  test("expect sample2 to move active BN players to Roster", function () {
    const roster: ITeam = require("./testRosters/MLB/sample2.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toMatchObject({
      "422.p.11074": "1B",
      "422.p.11232": "OF",
    });
  });
  test("expect sample3 to move Jimenez to OF, Glasnow to IL", function () {
    const roster: ITeam = require("./testRosters/MLB/sample3.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["OF", "Util"]).toContain(
      rosterModification.newPlayerPositions["422.p.10439"]
    );
    expect(rosterModification.newPlayerPositions["422.p.9616"]).toEqual("IL");
  });
});
