import { describe, expect, it, test, vi } from "vitest";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";
import { ITeamOptimizer } from "../../common/interfaces/ITeam.js";

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

describe.concurrent(
  "Test LineupOptimizer Class MLB with Max Games Played limits all positions above 0.9 threshold",
  function () {
    test("Already optimal", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/optimal.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({});
    });

    test("Swap one IL w/ BN, and one swap DTD w/ Healthy", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/1.json");
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
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/2.json");
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
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/3.json");
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
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/4.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({});
    });

    it("should move a higher rated pitcher from BN to Roster", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/13.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({
        "422.p.9585": "P",
        "422.p.10660": "BN",
      });
    });
  }
);

describe.concurrent(
  "Test LineupOptimizer Class MLB with Max Games Played limits some positions below 0.9 threshold - churn",
  function () {
    test("Two identically ranked BN players move to Roster (C, 1B, based on is_playing)", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/5.json");
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
    });

    it("Should only swap BN to 1B (is_playing=false)", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/6.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({
        "422.p.10621": "BN",
        "422.p.11279": "1B",
      });
    });

    it("Should not move any players in 3-way. Util player has no game today, but it should not use churning score, only 1B and C.", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/7.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({});
    });

    it("Should do a 3-way-swap between positions (C, 1B) below 0.9 threshold to fill not playing spot", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/8.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({
        "422.p.10621": "BN",
        "422.p.9096": "Util",
        "422.p.9540": "1B",
      });
    });

    it("Should move a pitcher from BN to Roster", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/11.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({
        "422.p.9585": "P",
        "422.p.8918": "BN",
      });
    });

    it("Should NOT move a pitcher from BN to Roster", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/12.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({});
    });
  }
);

describe.concurrent(
  "Test LineupOptimizer Class MLB with positions above Max Games Played limits",
  function () {
    it("Should reduce players at 2B and SS and move the two worst players to BN", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/9.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({
        "422.p.11731": "Util",
        "422.p.9540": "BN",

        "422.p.9517": "2B",
        "422.p.8949": "BN",
      });
    });

    it("should bench the worst pitcher (P)", function () {
      const roster: ITeamOptimizer = require("./testRosters/MLB/weekly/10.json");
      const lo = new LineupOptimizer(roster);
      const rosterModification = lo.optimizeStartingLineup();
      const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

      expect(isSuccessfullyOptimized).toEqual(true);

      expect(rosterModification.newPlayerPositions).toEqual({
        "422.p.10660": "BN",
      });
    });
  }
);
