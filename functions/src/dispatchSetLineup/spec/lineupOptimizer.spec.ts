import { LineupOptimizer } from "../classes/LineupOptimizer";
import { Team } from "../interfaces/Team";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("Test LineupOptimizer Class NHL", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it("test already optimal roster", async function () {
    const roster: Team = require("./testRosters/NHL/optimalRoster.json");
    const npp = {};
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(rosterModification.newPlayerPositions).not.toHaveProperty(
      "419.p.6370"
    ); // on IR+, should not be moved
    expect(isSuccessfullyOptimized).toEqual(true);
  });

  it("test one active C on bench, spare C slot", async function () {
    const roster: Team = require("./testRosters/NHL/oneMoveRequired.json");
    const npp = { "419.p.3737": "C" };
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    // expect(rosterModification.newPlayerPositions).toMatchObject(npp);
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(Object.values(rosterModification.newPlayerPositions)).not.toContain(
      "BN"
    );
    expect(rosterModification.newPlayerPositions).not.toHaveProperty(
      "419.p.6370"
    ); // on IR+, should not be moved
    expect(isSuccessfullyOptimized).toEqual(true);
  });

  it("test one active C on bench, one non-active C on roster", async function () {
    const roster: Team = require("./testRosters/NHL/oneSwapRequired.json");
    const npp = { "419.p.6726": "BN", "419.p.3737": "C" };
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(rosterModification.newPlayerPositions).not.toHaveProperty(
      "419.p.6370"
    ); // on IR+, should not be moved
  });

  it("test different active C on bench, one non-active C on roster", async function () {
    const roster: Team = require("./testRosters/NHL/oneSwapRequired2.json");
    const npp = { "419.p.6726": "BN", "419.p.7528": "C" };
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(rosterModification.newPlayerPositions).not.toHaveProperty(
      "419.p.6370"
    ); // on IR+, should not be moved
  });

  it("test all players on bench", async function () {
    const roster: Team = require("./testRosters/NHL/allPlayersBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(Object.values(rosterModification.newPlayerPositions)).not.toContain(
      "BN"
    );
    expect(rosterModification.newPlayerPositions).not.toHaveProperty(
      "419.p.6370"
    ); // on IR+, should not be moved
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "C"
      ).length
    ).toEqual(2);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "LW"
      ).length
    ).toEqual(2);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "RW"
      ).length
    ).toEqual(2);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "D"
      ).length
    ).toEqual(4);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "Util"
      ).length
    ).toEqual(3);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "G"
      ).length
    ).toEqual(2);
  });

  it("test no players with games on active roster", async function () {
    const roster: Team = require("./testRosters/NHL/allRosterPlayersHaveNoGames.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).not.toHaveProperty(
      "419.p.6370"
    ); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(rosterModification.newPlayerPositions["419.p.3737"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.3737"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.7528"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.7528"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.6877"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.6877"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5441"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5441"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5391"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5391"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.6060"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.6060"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.4930"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.4930"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.7910"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.7910"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5992"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5992"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.6184"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.6184"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.4687"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.4687"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5020"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5020"]).not.toEqual(
      "BN"
    );
  });
});

describe("Test LineupOptimizer Class NBA", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it("One healthy on IL, one IL on IL, one injured on roster", async function () {
    const roster: Team = require("./testRosters/NBA/potentiallyProblematic.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions["418.p.5482"]).toBeDefined();
    expect(["IL", "IL+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["418.p.5482"]
    );
    expect(rosterModification.newPlayerPositions["418.p.5864"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["418.p.5864"]).toEqual("IL");
  });
});
