export interface TeamFirestore {
  team_key?: string;
  uid: string;
  game_code: string;
  start_date: number;
  end_date: number;
  weekly_deadline: string | number;
  is_approved: boolean;
  is_setting_lineups: boolean;
  last_updated: number;
  allow_transactions: boolean;
  allow_dropping: boolean;
  allow_adding: boolean;
  allow_add_drops: boolean;
  allow_waiver_adds: boolean;
}

/**
 * Converts a TeamClient to a TeamFirestore
 *
 * @export
 * @param {TeamYahooAngular} team - The team to convert
 * @return {TeamFirestore} - The converted team
 */
export function yahooToFirestore(team: TeamYahooAngular): TeamFirestore {
  /* eslint-disable camelcase */
  const { uid = "", game_code, start_date, end_date, weekly_deadline } = team;

  return {
    uid,
    game_code,
    start_date,
    end_date,
    weekly_deadline,
    is_approved: true,
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

export interface TeamInterface {
  team_key: string;
  game_code: string;
  start_date: number;
  end_date: number;
  num_teams: number;
  weekly_deadline: string | number;
  faab_balance: number;
  waiver_rule: string;
  current_weekly_adds: number;
  current_season_adds: number;
  scoring_type: string;
  edit_key: string;
  max_weekly_adds: number;
  max_season_adds: number;
  max_games_played: number;
  max_innings_pitched: number;
}

export interface TeamYahooAngular extends TeamInterface {
  uid?: string;
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

// TODO: Merge in the ITeam here as well
// export interface ITeam extends TeamInterface {
//   players: IPlayer[];
//   coverage_type: string;
//   coverage_period: string;
//   weekly_deadline: string;
//   roster_positions: { [key: string]: number };
//   transactions: any[];
//   allow_transactions?: boolean;
//   allow_dropping?: boolean;
//   allow_adding?: boolean;
//   allow_add_drops?: boolean;
//   allow_waiver_adds?: boolean;
// }
