import { LineupOptimizer } from "../classes/LineupOptimizer";
import { Team } from "../interfaces/Team";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("Test LineupOptimizer Add Drop Players", function () {
  test("No drops allowed Daily", function () {
    const roster: Team = require("./testRosters/NHL/DailyDrops/noDropsAllowed.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions).toEqual([]);
  });

  test("No drops allowed Daily", function () {
    const roster: Team = require("./testRosters/NHL/DailyDrops/noAllowDroppingPropertyOnTeam.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions).toEqual([]);
  });

  test("No drops required Daily", function () {
    const roster: Team = require("./testRosters/NHL/DailyDrops/noDropsRequired.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions).toEqual([]);
  });

  test("Injured player illegally on IR, don't drop anyone", function () {
    const roster: Team = require("./testRosters/NHL/DailyDrops/injuredPlayerIllegallyOnIR.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions).toEqual([]);
  });

  test("Drop player with lowest score for 'Probable' player Daily", function () {
    const roster: Team = require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScore.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7155");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
  });

  test("No drops required Intraday", function () {
    const roster: Team = require("./testRosters/NHL/IntradayDrops/noDropsRequired.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions).toEqual([]);
  });

  test("Try dropping critical position G", function () {
    const roster: Team = require("./testRosters/NHL/IntradayDrops/tryDropCriticalPositionG.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    // drop second worst player since G is a critical position
    expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score for 'Probable' player Intraday", function () {
    const roster: Team = require("./testRosters/NHL/IntradayDrops/dropPlayerWithLowestScore.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop two players with lowest score for 'Questionable' and 'Game Time Decision' players Intraday", function () {
    const roster: Team = require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions[0].players[0].playerKey).toEqual("419.p.7528");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    expect(playerTransactions[1].players[0].playerKey).toEqual("419.p.7903");
    expect(playerTransactions[1].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score for 'Probable' player NBA", function () {
    const roster: Team = require("./testRosters/NBA/IntradayDrops/oneDropRequired.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();

    expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with third lowest score (lowest are non-editable for today) - NBA", function () {
    const roster: Team = require("./testRosters/NBA/IntradayDrops/oneDropRequiredThirdLowest.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5864");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    expect(rosterModification.newPlayerPositions).toEqual({});

    expect(isSuccessfullyOptimized).toEqual(true);
  });

  test("Drop player with lowest score - same as above but roster is now daily change - NBA", function () {
    const roster: Team = require("./testRosters/NBA/IntradayDrops/oneDropRequiredLowest.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    expect(rosterModification.newPlayerPositions).toEqual({});

    expect(isSuccessfullyOptimized).toEqual(true);
  });

  test("Drop player with lowest score for 'Game Time Decision' player NBA, also optimize some bench players", function () {
    const roster: Team = require("./testRosters/NBA/IntradayDrops/oneDropRequiredWithOptimization.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    expect(rosterModification.newPlayerPositions).toEqual({
      "418.p.6053": "BN",
      "418.p.6567": "F",
    });

    expect(isSuccessfullyOptimized).toEqual(true);
  });

  test("Drop two player with lowest score for 'Game Time Decision' players NBA, also optimize more advanced swap", function () {
    const roster: Team = require("./testRosters/NBA/IntradayDrops/twoDropsRequiredWithOptimization.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    expect(playerTransactions[1].players[0].playerKey).toEqual("418.p.6567");
    expect(playerTransactions[1].players[0].transactionType).toEqual("drop");
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      Object.keys(rosterModification.newPlayerPositions).length
    ).toBeGreaterThan(4);
  });

  test("Drop player with lowest score for 'Game Time Decision' player NBA weekly, also optimize some bench players", function () {
    const roster: Team = require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json");
    const lo = new LineupOptimizer(roster);
    const playerTransactions = lo.findDropPlayerTransactions();
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(playerTransactions[0].players[0].playerKey).toEqual("418.p.6047");
    expect(playerTransactions[0].players[0].transactionType).toEqual("drop");
    expect(rosterModification.newPlayerPositions).toEqual({
      "418.p.5471": "BN",
      "418.p.5826": "Util",
    });

    expect(isSuccessfullyOptimized).toEqual(true);
  });

  // If a it is intraday or NFL and player is not editable, filter out
});
