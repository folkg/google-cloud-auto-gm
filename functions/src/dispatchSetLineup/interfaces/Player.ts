export interface Player {
  addDropScore?: any;
  player_key: string;
  player_name: string;
  eligible_positions: string[];
  selected_position: string;
  is_editable: boolean;
  is_playing: boolean;
  injury_status: string;
  percent_started: number;
  percent_owned: number;
  transactions_delta: number;
  is_starting: number | string;
  rank_next7days: number;
  rank_projected_week: number;
  score: number;
}