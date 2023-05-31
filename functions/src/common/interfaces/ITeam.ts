import { IPlayer } from "./IPlayer";

interface CommonTeam {
  team_key: string;
  game_code: string;
  start_date: number;
  end_date: number;
  weekly_deadline: string;
}

interface YahooTeam extends CommonTeam {
  num_teams: number;
  edit_key: string;
  faab_balance: number;
  current_weekly_adds: number;
  current_season_adds: number;
  scoring_type: string;
  max_weekly_adds: number;
  max_season_adds: number;
  waiver_rule: string;
}

interface OptionsTeam {
  allow_transactions: boolean;
  allow_dropping: boolean;
  allow_adding: boolean;
  allow_add_drops: boolean;
  allow_waiver_adds: boolean;
}

export interface TeamFirestore extends CommonTeam, OptionsTeam {
  uid: string;
  is_subscribed: boolean;
  is_setting_lineups: boolean;
  last_updated: number;
}

export interface TeamAngular extends YahooTeam {
  uid?: string;
  max_games_played: number;
  max_innings_pitched: number;
  game_name: string;
  game_season: string;
  game_is_over: boolean;
  team_name: string;
  team_url: string;
  team_logo: string;
  league_name: string;
  rank: string | number;
  points_for: string | number;
  points_against: string | number;
  points_back: string | number;
  outcome_totals: {
    wins: string | number;
    losses: string | number;
    ties: string | number;
    percentage: string | number;
  };
}

export interface ITeam extends YahooTeam, Partial<OptionsTeam> {
  players: IPlayer[];
  coverage_type: string;
  coverage_period: string;
  roster_positions: { [key: string]: number };
  transactions: any[];
  games_played?: GamesPlayed[];
  innings_pitched?: InningsPitched;
}

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

/**
 * Converts a TeamAngular to a TeamFirestore
 *
 * @export
 * @param {TeamAngular} team - The team to convert
 * @return {TeamFirestore} - The converted team
 */
export function yahooToFirestore(team: TeamAngular): TeamFirestore {
  /* eslint-disable camelcase */
  const {
    uid = "",
    team_key,
    game_code,
    start_date,
    end_date,
    weekly_deadline,
  } = team;

  return {
    uid,
    team_key,
    game_code,
    start_date,
    end_date,
    weekly_deadline,
    is_subscribed: true,
    is_setting_lineups: false,
    last_updated: -1,
    allow_transactions: false,
    allow_dropping: false,
    allow_adding: false,
    allow_add_drops: false,
    allow_waiver_adds: false,
  };
  /* eslint-enable camelcase */
}
