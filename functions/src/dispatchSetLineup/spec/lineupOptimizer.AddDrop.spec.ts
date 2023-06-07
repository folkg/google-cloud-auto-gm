import { LineupOptimizer } from "../classes/LineupOptimizer";
import { ITeamOptimizer } from "../../common/interfaces/ITeam";

import { vi, describe, test, it, expect } from "vitest";

// mock firebase-admin
vi.mock("firebase-admin", () => ({
  initializeApp: vi.fn(),
  firestore: vi.fn(),
}));

describe.concurrent(
  "Unit Test LineupOptimizer Simple Add Drop Players",
  function () {
    test("No drops allowed Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noDropsAllowed.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("No drops allowed Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noAllowDroppingPropertyOnTeam.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("No drops required Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noDropsRequired.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("Injured player illegally on IR, don't drop anyone", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/injuredPlayerIllegallyOnIR.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("Drop player with lowest score for 'Probable' player Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScore.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7155");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("No drops required Intraday", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/noDropsRequired.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("Try dropping critical position G", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/tryDropCriticalPositionG.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      // drop second worst player since G is a critical position
      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Probable' player Intraday", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/dropPlayerWithLowestScore.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop two players with lowest score for 'Questionable' and 'Game Time Decision' players Intraday", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
      expect(playerTransactions[1].players[0].playerKey).toEqual("419.p.7903");
      expect(playerTransactions[1].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Probable' player NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequired.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with third lowest score (lowest are non-editable for today) - NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredThirdLowest.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5864");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score - same as above but roster is now daily change - NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredLowest.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Game Time Decision' player NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredWithOptimization.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop two player with lowest score for 'Game Time Decision' players NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/twoDropsRequiredWithOptimization.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
      expect(playerTransactions[1].players[0].playerKey).toEqual("418.p.6567");
      expect(playerTransactions[1].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Game Time Decision' player NBA weekly", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json");
      const lo = new LineupOptimizer(roster);
      lo.findDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.6047");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });
  }
);
