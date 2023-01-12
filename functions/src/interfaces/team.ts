export interface Team {
  game_code: string;
  team_key: string;
  scoring_type: string;
  start_date: number;
  end_date: number;
  weekly_deadline: string | number;
  edit_key: string;
  is_approved: boolean;
  is_setting_lineups: boolean;
  last_updated: number;
}
