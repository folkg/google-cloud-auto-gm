import { describe, expect, it, test, vi } from "vitest";
import { Team } from "../Team.js";
import spacetime from "spacetime";

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
describe.concurrent("Test Team Class", () => {
  it("should remove IL eligible position from players in pending transactions", () => {
    const teamJSON = require("./MLBpendingTransactions.json");
    const team = new Team(teamJSON[0]);

    const testPlayer = team.allPlayers.find(
      (p) => p.player_key === "422.p.8616"
    );
    expect(testPlayer?.eligible_positions).toEqual(["RP", "P", "BN"]);
  });

  it("should remove IR+ eligible position from players in pending transactions", () => {
    const teamJSON = require("./MLBpendingTransactionsWIR+.json");
    const team = new Team(teamJSON[0]);

    const testPlayer = team.allPlayers.find(
      (p) => p.player_key === "422.p.8616"
    );
    expect(testPlayer?.eligible_positions).toEqual(["RP", "P", "BN"]);
  });

  it("should remove IL eligible position from players in proposed trades", () => {
    const teamJSON = require("./MLBpendingTransactions.json");
    const team = new Team(teamJSON[0]);

    const testPlayer = team.allPlayers.find(
      (p) => p.player_key === "422.p.12120"
    );
    expect(testPlayer?.eligible_positions).toEqual(["SP", "P", "BN"]);
    const testPlayer2 = team.allPlayers.find(
      (p) => p.player_key === "422.p.11121"
    );
    expect(testPlayer2?.eligible_positions).toEqual(["SP", "RP", "P", "BN"]);
  });

  it("should not remove IL eligibility from Bryce Elder in pending transaction if they are already on the IL", () => {
    const teamJSON = require("./MLBpendingTransactionsWpendingILtrade.json");
    const team = new Team(teamJSON[0]);

    const testPlayer = team.allPlayers.find(
      (p) => p.player_key === "422.p.12120"
    );
    expect(testPlayer?.eligible_positions).toEqual(["SP", "P", "IL", "BN"]);
    const testPlayer2 = team.allPlayers.find(
      (p) => p.player_key === "422.p.11121"
    );
    expect(testPlayer2?.eligible_positions).toEqual(["SP", "RP", "P", "BN"]);
  });

  it("should have an add/drop differential of 0", () => {
    const teamJSON = require("./MLBpendingTransactionsWIR+.json");
    const team = new Team(teamJSON[0]);

    expect(team.allPendingAddDropDifferential).toEqual(0);
    expect(team.pendingAddPlayerKeys).toEqual(["422.p.9193"]);
    expect(team.pendingLockedPlayerKeys).toEqual([
      "422.p.8616",
      "422.p.12120",
      "422.p.11121",
    ]);
  });

  it("should have an add/drop differential of -1", () => {
    const teamJSON = require("./MLBpendingTransactionsWDifferential-1.json");
    const team = new Team(teamJSON[0]);

    expect(team.allPendingAddDropDifferential).toEqual(-1);
    expect(team.pendingAddPlayerKeys).toEqual([]);
    expect(team.pendingLockedPlayerKeys).toEqual([
      "422.p.8616",
      "422.p.12120",
      "422.p.11121",
    ]);
  });

  it("should affect add/drop differential if a player is in a 'pending' (not 'proposed') trade", () => {
    const teamJSON = require("./MLBpendingTransactionsWDifferential-2.json");
    const team = new Team(teamJSON[0]);

    expect(team.allPendingAddDropDifferential).toEqual(-2);
    expect(team.pendingAddPlayerKeys).toEqual(["422.p.9691"]);
    expect(team.pendingLockedPlayerKeys).toEqual([
      "422.p.8616",
      "422.p.12120",
      "422.p.11121",
    ]);
  });

  it("should have an add/drop differential of 2", () => {
    const teamJSON = require("./MLBpendingTransactionsWDifferential2.json");
    const team = new Team(teamJSON[0]);

    expect(team.allPendingAddDropDifferential).toEqual(2);
    expect(team.pendingAddPlayerKeys).toEqual([
      "422.p.9193",
      "422.p.11121",
      "422.p.9691",
    ]);
    expect(team.pendingLockedPlayerKeys).toEqual([
      "422.p.12120",
      "422.p.11121",
    ]);
  });

  test("transaction pace is good for both season and week", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const teamJSON = require("../../spec/testRosters/MLB/free2spotsPace1.json"); // 1/50 season, 1/5 weekly
    const team = new Team(teamJSON);

    expect(team.isCurrentTransactionPaceOK()).toEqual(true);
  });

  test("transaction pace is good for season, bad for week", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const teamJSON = require("../../spec/testRosters/MLB/free2spotsPace2.json"); // 3/50 season, 3/5 weekly
    const team = new Team(teamJSON);

    expect(team.isCurrentTransactionPaceOK()).toEqual(false);
  });

  test("transaction pace is bad for season, good for week", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const teamJSON = require("../../spec/testRosters/MLB/free2spotsPace3.json"); // 26/50 season, 0/5 weekly
    const team = new Team(teamJSON);

    expect(team.isCurrentTransactionPaceOK()).toEqual(false);
  });

  test("underfilledPositions for teams with compound positions (eg. Util, MI, CI)", () => {
    const teamJSON = require("../../spec/testRosters/MLB/unfilledRosterPositions.json");
    const team = new Team(teamJSON);

    expect(team.underfilledPositions).toEqual(["MI"]);
  });

  test("criticalPositions for teams with compound positions (eg. Util, MI, CI)", () => {
    const teamJSON = require("../../spec/testRosters/MLB/unfilledRosterPositions.json");
    const team = new Team(teamJSON);

    expect(team.criticalPositions).toEqual(["C", "SS", "MI"]);
  });

  test("almostCriticalPositions for teams with compound positions (eg. Util, MI, CI)", () => {
    const teamJSON = require("../../spec/testRosters/MLB/unfilledRosterPositions.json");
    const team = new Team(teamJSON);

    expect(team.almostCriticalPositions).toEqual(["C", "SS", "RP", "MI"]);
  });

  test("almostCriticalPositions where Util is critical for teams with compound positions (eg. Util, MI, CI)", () => {
    const teamJSON = require("../../spec/testRosters/MLB/unfilledRosterPositions-UtilCritical.json");
    const team = new Team(teamJSON);

    expect(team.almostCriticalPositions).toEqual([
      "C",
      "SS",
      "RP",
      "MI",
      "Util",
    ]);
  });

  it("should return empty array, since there is no max cap on any MLB positions", () => {
    const teamJSON = require("../../spec/testRosters/MLB/unfilledRosterPositions.json");
    const team = new Team(teamJSON);

    expect(team.atMaxCapPositions).toEqual([]);
  });

  it("should return QB, K and DEF as at max capacity, since they have max cap of extra players", () => {
    const teamJSON = require("../../../common/services/yahooAPI/spec/testYahooLineupJSON/output/NFLLineups.json");
    const team = new Team(teamJSON[1]);

    expect(team.atMaxCapPositions).toEqual(["QB", "K", "DEF"]);
  });
});
