import { Team } from "../Team";
import { vi, describe, it, expect } from "vitest";

vi.mock("firebase-admin", () => ({
  initializeApp: vi.fn(),
  firestore: vi.fn(),
}));
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

    expect(team.pendingAddDropDifferential).toEqual(0);
  });

  it("should have an add/drop differential of -1", () => {
    const teamJSON = require("./MLBpendingTransactionsWDifferential-1.json");
    const team = new Team(teamJSON[0]);

    expect(team.pendingAddDropDifferential).toEqual(-1);
  });

  it("should affect add/drop differential if a player is in a 'pending' (not 'proposed') trade", () => {
    const teamJSON = require("./MLBpendingTransactionsWDifferential-2.json");
    const team = new Team(teamJSON[0]);

    expect(team.pendingAddDropDifferential).toEqual(-2);
  });

  it("should have an add/drop differential of 2", () => {
    const teamJSON = require("./MLBpendingTransactionsWDifferential2.json");
    const team = new Team(teamJSON[0]);

    expect(team.pendingAddDropDifferential).toEqual(2);
  });
});