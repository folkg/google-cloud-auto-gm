export interface RosterTransaction {
  teamKey: string;
  players: [
    {
      playerKey: string;
      transactionType: string;
    }
  ];
}
