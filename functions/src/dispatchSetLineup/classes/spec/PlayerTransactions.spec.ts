import { describe, expect, it, beforeAll } from "vitest";
import { PlayerTransactions } from "../PlayerTransactions";
import { PlayerTransaction } from "../../interfaces/PlayerTransaction";

describe.concurrent("PlayerTransactions", () => {
  let playerTransactions: PlayerTransactions;
  let playerTransaction: PlayerTransaction;

  beforeAll(() => {
    playerTransactions = new PlayerTransactions();
    playerTransaction = {
      teamKey: "test",
      sameDayTransactions: true,
      players: [
        {
          playerKey: "1",
          transactionType: "add",
          isInactiveList: false,
        },
        {
          playerKey: "2",
          transactionType: "drop",
          isInactiveList: false,
        },
        {
          playerKey: "3",
          transactionType: "add",
          isInactiveList: true,
        },
        {
          playerKey: "4",
          transactionType: "drop",
          isInactiveList: true,
        },
      ],
    };
    playerTransactions.addTransaction(playerTransaction);
  });

  it("should add a transaction", () => {
    expect(playerTransactions.transactions).toContain(playerTransaction);
  });

  it("should get dropped player keys", () => {
    expect(playerTransactions.droppedPlayerKeys).toEqual(["2", "4"]);
  });

  it("should get net roster spot changes", () => {
    expect(playerTransactions.netRosterSpotChanges).toEqual(1);
  });

  it("should get net roster spot changes, again..", () => {
    const playerTransactions = new PlayerTransactions();
    const playerTransaction = {
      teamKey: "test",
      sameDayTransactions: true,
      players: [
        {
          playerKey: "1",
          transactionType: "add",
          isInactiveList: false,
        },
        {
          playerKey: "2",
          transactionType: "drop",
          isInactiveList: false,
        },
        {
          playerKey: "3",
          transactionType: "add",
          isInactiveList: true,
        },
        {
          playerKey: "4",
          transactionType: "drop",
          isInactiveList: true,
        },
        {
          playerKey: "5",
          transactionType: "add",
          isInactiveList: false,
        },
        {
          playerKey: "6",
          transactionType: "drop",
          isInactiveList: true,
        },
      ],
    };
    playerTransactions.addTransaction(playerTransaction);
    expect(playerTransactions.netRosterSpotChanges).toEqual(2);
  });
});