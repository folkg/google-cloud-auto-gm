import { Roster } from "../interfaces/roster";
import { optimizeStartingLineup2 } from "./newLineupOptimizer.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("test optimizeStartingLineup2", function () {
  it("test already optimal roster", async function () {
    let roster: Roster = require("./testRosters/optimalRoster.json");
    const rm = {
      teamKey: "419.l.28340.t.1",
      coverageType: "date",
      coveragePeriod: "2023-02-28",
      newPlayerPositions: {},
    };
    const result = await optimizeStartingLineup2(roster);
    console.log("test functions.optimizeStartingLineup2");
    expect(result).toEqual(rm);
  });

  it("test one active player on bench", async function () {
    let roster: Roster = require("./testRosters/oneMoveRequired.json");
    const rm = {
      teamKey: "419.l.28340.t.1",
      coverageType: "date",
      coveragePeriod: "2023-02-28",
      newPlayerPositions: { "419.p.3737": "C" },
    };
    const result = await optimizeStartingLineup2(roster);
    console.log("test functions.optimizeStartingLineup2");
    expect(result).toEqual(rm);
  });
});
