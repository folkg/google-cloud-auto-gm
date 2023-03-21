import { IPlayer } from "./IPlayer";

export interface Team {
  team_key: string;
  players: IPlayer[];
  coverage_type: string;
  coverage_period: string;
  weekly_deadline: string;
  start_date: number;
  end_date: number;
  game_code: string;
  num_teams_in_league: number;
  roster_positions: { [key: string]: number };
  current_weekly_adds: number;
  current_season_adds: number;
  max_weekly_adds: number;
  max_season_adds: number;
  faab_balance: number;
  allow_dropping?: any;
  allow_adding?: any;
}
