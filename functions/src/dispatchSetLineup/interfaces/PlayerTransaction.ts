export interface PlayerTransaction {
  teamKey: string;
  isImmediateTransaction: boolean;
  players: [
    {
      playerKey: string;
      transactionType: string;
    }
  ];
}
