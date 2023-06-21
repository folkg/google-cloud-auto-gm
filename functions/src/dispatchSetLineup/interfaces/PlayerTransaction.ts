export interface PlayerTransaction {
  teamKey: string;
  sameDayTransactions: boolean;
  reason: string;
  players: TPlayer[];
}

export type TPlayer = {
  playerKey: string;
  transactionType: TransactionType;
  isInactiveList: boolean;
  isFromWaivers?: boolean;
};

export type TransactionType = "add" | "drop" | "add/drop";
