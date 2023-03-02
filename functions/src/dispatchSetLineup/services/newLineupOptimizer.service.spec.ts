import { Team } from "../interfaces/Team";
import { optimizeStartingLineup2 } from "./newLineupOptimizer.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("test NHL optimizeStartingLineup2", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it("test already optimal roster", async function () {
    const roster: Team = require("./testRosters/optimalRoster.json");
    const npp = {};
    const result = await optimizeStartingLineup2(roster);
    expect(result.newPlayerPositions).toEqual(npp);
    expect(result.newPlayerPositions).not.toHaveProperty("419.p.6370"); // on IR+, should not be moved
  });

  it("test one active C on bench, spare C slot", async function () {
    const roster: Team = require("./testRosters/oneMoveRequired.json");
    const npp = { "419.p.3737": "C" };
    const result = await optimizeStartingLineup2(roster);
    // expect(result.newPlayerPositions).toMatchObject(npp);
    expect(result.newPlayerPositions).toEqual(npp);
    expect(Object.values(result.newPlayerPositions)).not.toContain("BN");
    expect(result.newPlayerPositions).not.toHaveProperty("419.p.6370"); // on IR+, should not be moved
  });

  it("test one active C on bench, one non-active C on roster", async function () {
    const roster: Team = require("./testRosters/oneSwapRequired.json");
    const npp = { "419.p.6726": "BN", "419.p.3737": "C" };
    const result = await optimizeStartingLineup2(roster);
    expect(result.newPlayerPositions).toEqual(npp);
    expect(result.newPlayerPositions).not.toHaveProperty("419.p.6370"); // on IR+, should not be moved
  });

  it("test different active C on bench, one non-active C on roster", async function () {
    const roster: Team = require("./testRosters/oneSwapRequired2.json");
    const npp = { "419.p.6726": "BN", "419.p.7528": "C" };
    const result = await optimizeStartingLineup2(roster);
    expect(result.newPlayerPositions).toEqual(npp);
    expect(result.newPlayerPositions).not.toHaveProperty("419.p.6370"); // on IR+, should not be moved
  });

  it("test all players on bench", async function () {
    const roster: Team = require("./testRosters/allPlayersBN.json");
    const result = await optimizeStartingLineup2(roster);
    expect(Object.values(result.newPlayerPositions)).not.toContain("BN");
    expect(result.newPlayerPositions).not.toHaveProperty("419.p.6370"); // on IR+, should not be moved
    expect(
      Object.values(result.newPlayerPositions).filter((v) => v === "C").length
    ).toEqual(2);
    expect(
      Object.values(result.newPlayerPositions).filter((v) => v === "LW").length
    ).toEqual(2);
    expect(
      Object.values(result.newPlayerPositions).filter((v) => v === "RW").length
    ).toEqual(2);
    expect(
      Object.values(result.newPlayerPositions).filter((v) => v === "D").length
    ).toEqual(4);
    expect(
      Object.values(result.newPlayerPositions).filter((v) => v === "Util")
        .length
    ).toEqual(3);
    expect(
      Object.values(result.newPlayerPositions).filter((v) => v === "G").length
    ).toEqual(2);
  });

  it("test no players with games on active roster", async function () {
    const roster: Team = require("./testRosters/allRosterPlayersHaveNoGames.json");
    const result = await optimizeStartingLineup2(roster);
    expect(result.newPlayerPositions).not.toHaveProperty("419.p.6370"); // on IR+, should not be moved
    expect(result.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(result.newPlayerPositions["419.p.3737"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.3737"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.7528"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.7528"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.6877"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.6877"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.5441"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.5441"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.5391"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.5391"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.6060"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.6060"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.4930"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.4930"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.7910"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.7910"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.5992"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.5992"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.6184"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.6184"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.4687"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.4687"]).not.toEqual("BN");
    expect(result.newPlayerPositions["419.p.5020"]).toBeDefined();
    expect(result.newPlayerPositions["419.p.5020"]).not.toEqual("BN");
  });

  it("NBA Problem", async function () {
    const roster: Team = require("./testRosters/NBA/potentiallyProblematic.json");
    const result = await optimizeStartingLineup2(roster);

    expect(result.newPlayerPositions["418.p.5482"]).toBeDefined();
    expect(["IL", "IL+", "BN"]).not.toContain(
      result.newPlayerPositions["418.p.5482"]
    );
    expect(result.newPlayerPositions["418.p.5864"]).toBeDefined();
    expect(result.newPlayerPositions["418.p.5864"]).toEqual("IL");
  });
});
