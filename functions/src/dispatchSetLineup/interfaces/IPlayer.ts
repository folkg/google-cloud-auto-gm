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
  rank_last30days: number;
  rank_last14days: number;
  rank_next7days: number;
  rank_rest_of_season: number;
  rank_last4weeks: number;
  rank_projected_week: number;
  rank_next4weeks: number;
}
