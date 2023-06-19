import { PlayerTransaction } from "../interfaces/PlayerTransaction.js";

export class PlayerTransactions {
  private _transactions: PlayerTransaction[] = [];

  public addTransaction(transaction: PlayerTransaction): void {
    this._transactions.push(transaction);
  }

  public get transactions(): PlayerTransaction[] {
    return this._transactions.slice();
  }

  public get droppedPlayerKeys(): string[] {
    return this._transactions
      .flatMap((transaction) => transaction.players)
      .filter((player) => player.transactionType === "drop")
      .map((player) => player.playerKey);
  }

  public get netRosterSpotChanges(): number {
    return this._transactions
      .flatMap((transaction) => transaction.players)
      .reduce(calculateRosterSpotChanges, 0);

    function calculateRosterSpotChanges(
      accumulator: number,
      player: any
    ): number {
      if (player.transactionType === "add") {
        return accumulator + 1;
      } else if (player.transactionType === "drop" && !player.isInactiveList) {
        return accumulator - 1;
      }
      return accumulator;
    }
  }
}
