import { Roster } from "../interfaces/roster";
import { optimizeStartingLineup2 } from "./newLineupOptimizer.service";
import { optimizeStartingLineup } from "./yahooLineupOptimizer.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("test optimizeStartingLineup2", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it("test already optimal roster", async function () {
    const roster: Roster = require("./testRosters/optimalRoster.json");
    const npp = {};
    const result = await optimizeStartingLineup2(roster);
    expect(result.newPlayerPositions).toEqual(npp);
  });

  it("test one active player on bench", async function () {
    const roster: Roster = require("./testRosters/oneMoveRequired.json");
    const npp = { "419.p.3737": "C" };
    const result = await optimizeStartingLineup2(roster);
    expect(result.newPlayerPositions).toEqual(npp);
  });
});

describe("test optimizeStartingLineup1", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it("test already optimal roster", async function () {
    const roster: Roster = require("./testRosters/optimalRoster.json");
    const npp = {};
    const result = optimizeStartingLineup(roster);
    expect(result.newPlayerPositions).toEqual(npp);
  });

  it("test one active player on bench", async function () {
    const roster2: Roster = require("./testRosters/oneMoveRequired.json");
    const npp = { "419.p.3737": "C" };
    const result = optimizeStartingLineup(roster2);
    expect(result.newPlayerPositions).toEqual(npp);
  });
});
