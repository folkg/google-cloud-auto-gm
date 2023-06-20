export interface PlayerTransaction {
  teamKey: string;
  sameDayTransactions: boolean;
  reason: string;
  players: {
    playerKey: string;
    transactionType: string;
    isInactiveList: boolean;
  }[];
}
