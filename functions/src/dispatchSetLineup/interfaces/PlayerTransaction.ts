export interface PlayerTransaction {
  teamName: string;
  leagueName: string;
  teamKey: string;
  sameDayTransactions: boolean;
  reason: string;
  isFaabRequired?: boolean;
  players: TPlayer[];
}

export type TPlayer = {
  playerKey: string;
  transactionType: TransactionType;
  isInactiveList: boolean;
  isFromWaivers?: boolean;
};

export type TransactionType = "add" | "drop" | "add/drop";
