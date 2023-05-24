import { IPlayer } from "./IPlayer";

export interface ITeam {
  team_key: string;
  players: IPlayer[];
  coverage_type: string;
  coverage_period: string;
  weekly_deadline: string;
  edit_key: string;
  start_date: number;
  end_date: number;
  game_code: string;
  num_teams: number;
  roster_positions: { [key: string]: number };
  scoring_type: string;
  waiver_rule: string;
  transactions: any[];
  games_played?: GamesPlayed[];
  innings_pitched?: InningsPitched;
  current_weekly_adds: number;
  current_season_adds: number;
  max_weekly_adds: number;
  max_season_adds: number;
  faab_balance: number;
  allow_transactions?: boolean;
  allow_dropping?: boolean;
  allow_adding?: boolean;
  allow_add_drops?: boolean;
  allow_waiver_adds?: boolean;
}

// TODO: Remove the max_games_played and max_innings_pitched properties above, and from the API call.
export interface GamesPlayed {
  position: string;
  games_played: {
    played: number;
    max: number;
    projected: number;
  };
}

export interface InningsPitched {
  pitched: number;
  max: number;
  projected: number;
}
