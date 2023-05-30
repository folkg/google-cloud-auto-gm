import { LineupOptimizer } from "../classes/LineupOptimizer";
import { ITeam } from "../interfaces/ITeam";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("Test LineupOptimizer Class MLB with Max Games Played limits all positions above 0.9 threshold", function () {
  test("Already optimal", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/optimal.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  test("Swap one IL w/ BN, and one swap DTD w/ Healthy", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/1.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.11643": "BN",
      "422.p.9585": "IL",
      "422.p.11118": "BN",
      "422.p.8949": "2B",
    });
  });

  it("Should optimize the roster", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/2.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    // console.log(JSON.stringify(lo.getCurrentTeamState(), null, 2));
    expect(isSuccessfullyOptimized).toEqual(true);

    // TODO: Maybe change algo so IL players on BN do not get the added 1000 point boost
    // This should allow three way swaps
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.9414": "IL",
      "422.p.9585": "BN",
      "422.p.11643": "OF",
    });
  });

  test("Two high ranked BN players to Roster", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/3.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.9096": "C",
      "422.p.11853": "BN",
      "422.p.11279": "Util",
      "422.p.9540": "BN",
    });
  });

  test("Two identically ranked BN players stay on BN", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/4.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({});
  });
});

describe("Test LineupOptimizer Class MLB with Max Games Played limits some positions below 0.9 threshold - churn", function () {
  test("Two identically ranked BN players move to Roster (C, 1B, based on percent started)", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/5.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.9096": "C",
      "422.p.11853": "BN",
      "422.p.11279": "1B",
      "422.p.10621": "BN",
    });
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.9096": "C",
      "422.p.11853": "BN",
      "422.p.10621": "BN",

      "422.p.9103": "Util",
      "422.p.9540": "1B",
    });
  });

  it("Should only swap 1B from BN to Roster", function () {
    const roster: ITeam = require("./testRosters/MLB/weekly/6.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    console.log(JSON.stringify(lo.getCurrentTeamState(), null, 2));
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.10621": "BN",
      "422.p.11279": "1B",
    });
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.10621": "BN",
      "422.p.9103": "Util",
      "422.p.9540": "1B",
    });
  });

  it("Should not move any players in 3-way. Util player has no game today, but it should not use churning score, only 1B and C.", function () {});
  it("Should do a 3 way swap between positions (C, 1B) below 0.9 threshold", function () {});
});

describe("Test LineupOptimizer Class MLB with positions above Max Games Played limits", function () {
  it("Should BN the worse player at position over the max games played limit", function () {});
});
