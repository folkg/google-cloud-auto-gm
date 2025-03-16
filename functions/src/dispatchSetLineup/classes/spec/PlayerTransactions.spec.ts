import { beforeAll, describe, expect, it } from "vitest";
import type { PlayerTransaction } from "../../interfaces/PlayerTransaction";
import { PlayerTransactions } from "../PlayerTransactions";

describe("PlayerTransactions", () => {
  let playerTransactions: PlayerTransactions;
  let playerTransaction: PlayerTransaction;

  beforeAll(() => {
    playerTransactions = new PlayerTransactions();
    playerTransaction = {
      teamKey: "test",
      sameDayTransactions: true,
      reason: "test",
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
});
