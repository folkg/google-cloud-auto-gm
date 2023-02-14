export interface Roster {
  team_key: string;
  players: Player[];
  coverage_type: string;
  coverage_period: string;
  weekly_deadline: string;
  game_code: string;
  roster_positions: any;
  empty_positions: any;
}

export interface Player {
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

export interface RosterModification {
  teamKey: string;
  coverageType: string;
  coveragePeriod: string;
  newPlayerPositions: any;
}
