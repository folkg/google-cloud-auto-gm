export interface PlayerTransaction {
  teamKey: string;
  sameDayTransactions: boolean;
  players: [
    {
      playerKey: string;
      transactionType: string;
    }
  ];
}
