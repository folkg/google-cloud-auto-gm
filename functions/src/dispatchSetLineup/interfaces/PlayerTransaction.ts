export interface PlayerTransaction {
  teamKey: string;
  players: [
    {
      playerKey: string;
      transactionType: string;
    }
  ];
}
