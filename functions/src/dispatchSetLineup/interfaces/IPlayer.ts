export interface IPlayer {
  player_key: string;
  player_name: string;
  eligible_positions: string[];
  selected_position: string;
  is_editable: boolean;
  is_playing: boolean;
  injury_status: string;
  percent_started: number;
  percent_owned: number;
  is_starting: number | string;
  ranks: PlayerRanks;
}

export interface PlayerRanks {
  last30Days: number;
  last14Days: number;
  next7Days: number;
  restOfSeason: number;
  last4Weeks: number;
  projectedWeek: number;
  next4Weeks: number;
}
