import { describe, expect, it, test, vi } from "vitest";
import { ITeamOptimizer } from "../../common/interfaces/ITeam.js";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";
import { PlayerCollection } from "../classes/PlayerCollection.js";

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
  "Unit Test LineupOptimizer Simple Drop Players",
  function () {
    test("No drops allowed Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noDropsAllowed.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("No drops allowed Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noAllowDroppingPropertyOnTeam.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("No drops required Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noDropsRequired.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("Injured player illegally on IR, don't drop anyone", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/injuredPlayerIllegallyOnIR.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("Drop player with lowest score for 'Probable' player Daily", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScore.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7155");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("No drops required Intraday", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/noDropsRequired.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions).toEqual([]);
    });

    test("Try dropping critical position G", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/tryDropCriticalPositionG.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      // drop second worst player since G is a critical position
      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Probable' player Intraday", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/dropPlayerWithLowestScore.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop two players with lowest score for 'Questionable' and 'Game Time Decision' players Intraday", function () {
      const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
      expect(playerTransactions[1].players[0].playerKey).toEqual("419.p.7903");
      expect(playerTransactions[1].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Probable' player NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequired.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with third lowest score (lowest are non-editable for today) - NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredThirdLowest.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5864");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score - same as above but roster is now daily change - NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredLowest.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Game Time Decision' player NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredWithOptimization.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });

    test("Drop two player with lowest score for 'Game Time Decision' players NBA", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/twoDropsRequiredWithOptimization.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
      expect(playerTransactions[1].players[0].playerKey).toEqual("418.p.6567");
      expect(playerTransactions[1].players[0].transactionType).toEqual("drop");
    });

    test("Drop player with lowest score for 'Game Time Decision' player NBA weekly", function () {
      const roster: ITeamOptimizer = require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json");
      const lo = new LineupOptimizer(roster);
      lo.generateDropPlayerTransactions();
      const playerTransactions = lo.playerTransactions;

      expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.6047");
      expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    });
  }
);

describe.concurrent("Add players", () => {
  test("set addCandidates with MLB players (with one candidate already pending waivers)", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/pendingTransactionsAddCandidates.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");

    const loAddCandidates: PlayerCollection | undefined = lo.addCandidates;
    // expect(loAddCandidates?.players.length).toBeGreaterThanOrEqual(25);
    // expect(loAddCandidates?.players.length).toBeLessThanOrEqual(50);
    expect(loAddCandidates?.players.length).toEqual(47);
  });

  it("should free 0 roster spots before adding players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/optimal.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const numEmptyRosterSpots =
      lo.getCurrentTeamStateObject().numEmptyRosterSpots;

    expect(numEmptyRosterSpots).toEqual(0);
  });

  it("should free 3 roster spots (injured players to IL) before adding players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const numEmptyRosterSpots =
      lo.getCurrentTeamStateObject().numEmptyRosterSpots;

    expect(numEmptyRosterSpots).toEqual(3);
  });

  it("should add top 3 players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const transactions = lo.playerTransactions;

    expect(transactions).toEqual([
      {
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
          },
        ],
        reason:
          "Moved Jordan Montgomery to the inactive list to make room for Dansby Swanson",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
      {
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
        ],
        reason:
          "Moved Brandon Nimmo to the inactive list to make room for Anthony Santander",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
      {
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
          },
        ],
        reason:
          "Moved Bryan Reynolds to the inactive list to make room for Jordan Walker",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
    ]);
  });

  // Should not add top player because they are LTIR
  // Should not add top player because they are already in a current pending claim
  // Should add 2 worse players for unfilled positions x and y
  // Should add worse player for unfilled position, and then top player
  // Should add worse, boosted player because they have critical position eligibility
  // Should add no one because we have an illegal lineup
  // Should not add top player because they are on waivers, and waiver setting is off
  // Should add no one because the currentPaceForGamesPlayed not good
});
