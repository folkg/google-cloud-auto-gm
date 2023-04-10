import { LineupOptimizer } from "../classes/LineupOptimizer";
import { ITeam } from "../interfaces/ITeam";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// Use this to mock the global MLB_STARTING_PITCHERS array where needed
const yahooStartingPlayerService = require("../../common/services/yahooAPI/yahooStartingPlayer.service");

describe("Test LineupOptimizer Class MLB Daily", function () {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  test("Already optimal roster", function () {
    const roster: ITeam = require("./testRosters/MLB/optimal.json");
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
  test("sample 1 should pass the isSuccessfullyOptimized test", function () {
    const roster: ITeam = require("./testRosters/MLB/sample1.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.10577": "OF",

      "422.p.9557": "BN",
      "422.p.10923": "SS",
      "422.p.10036": "2B",
      "422.p.9876": "Util",

      "422.p.10166": "C",
      "422.p.9096": "BN",

      "422.p.11014": "P",
      "422.p.11251": "BN",
    });
  });
  it("should move 2 starting pitchers to lineup, do nothing with bad starting batters on BN", function () {
    const roster: ITeam = require("./testRosters/MLB/sample4.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["422.p.10660"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["422.p.11251"]).toBeDefined();
    expect(
      rosterModification.newPlayerPositions["422.p.9557"]
    ).not.toBeDefined();
    expect(
      rosterModification.newPlayerPositions["422.p.12339"]
    ).not.toBeDefined();
    expect(
      rosterModification.newPlayerPositions["422.p.9096"]
    ).not.toBeDefined();
  });
  it("should move 2 starting pitchers to lineup, swap one non-starter to BN, leave other bad batters on BN", function () {
    const roster: ITeam = require("./testRosters/MLB/sample5.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["422.p.10660"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["422.p.11251"]).toBeDefined();
    expect(rosterModification.newPlayerPositions).toMatchObject({
      "422.p.9096": "C",
      "422.p.10166": "BN",
    });
    expect(
      rosterModification.newPlayerPositions["422.p.9557"]
    ).not.toBeDefined();
    expect(
      rosterModification.newPlayerPositions["422.p.12339"]
    ).not.toBeDefined();
  });
  it("should move unconfirmed good batters to roster in favour of bad confirmed batters", function () {
    const roster: ITeam = require("./testRosters/MLB/sample6.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.11265": "OF",
      "422.p.9858": "BN",
      "422.p.11855": "C",
      "422.p.9530": "BN",
    });
  });
  it("should move non-starting SP to BN in favour of unconfirmed RP using Pitchers Array", function () {
    const roster: ITeam = require("./testRosters/MLB/sample7.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    jest
      .spyOn(yahooStartingPlayerService, "getMLBStartingPitchers")
      .mockReturnValue(["422.p.10597", "422.p.11398"]);
    expect(yahooStartingPlayerService.getMLBStartingPitchers()).toEqual([
      "422.p.10597",
      "422.p.11398",
    ]);

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.10970": "BN",
      "422.p.11750": "BN",
      "422.p.11251": "P",
      "422.p.10660": "P",
    });
  });

  it("should move non-starting SP to BN in favour of unconfirmed RP NOT using Pitchers Array", function () {
    const roster: ITeam = require("./testRosters/MLB/sample7.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.10970": "BN",
      "422.p.11750": "BN",
      "422.p.11251": "P",
      "422.p.10660": "P",
    });
  });
  it("should not alarm for empty roster positions where there are no players eligible to fill unfilled positions", function () {
    const roster: ITeam = require("./testRosters/MLB/unfilledRosterPositions.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "422.p.10504": "BN",
      "422.p.10566": "Util",
      "422.p.11391": "MI",
    });
  });
});
