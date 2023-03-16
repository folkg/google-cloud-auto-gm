import { IPlayer } from "./IPlayer";

export interface Team {
  team_key: string;
  players: IPlayer[];
  coverage_type: string;
  coverage_period: string;
  weekly_deadline: string;
  game_code: string;
  roster_positions: { [key: string]: number };
  allow_dropping?: any;
  allow_adding?: any;
}
