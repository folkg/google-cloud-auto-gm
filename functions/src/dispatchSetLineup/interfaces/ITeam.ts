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
  num_teams_in_league: number;
  roster_positions: { [key: string]: number };
  league_scoring_type: string;
  waiver_rule: string;
  transactions: any[];
  current_weekly_adds: number;
  current_season_adds: number;
  max_weekly_adds: number;
  max_season_adds: number;
  faab_balance: number;
  max_games_played: number;
  max_innings_pitched: number;
  allow_dropping?: boolean;
  allow_adding?: boolean;
}
