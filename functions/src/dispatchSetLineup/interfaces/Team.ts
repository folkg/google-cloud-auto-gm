import { Player } from "./Player";

export interface Team {
  team_key: string;
  players: Player[];
  coverage_type: string;
  coverage_period: string;
  weekly_deadline: string;
  game_code: string;
  roster_positions: { [key: string]: number };
}