export interface TeamFirestore {
  uid: string;
  game_code: string;
  scoring_type?: string;
  team_key?: string;
  start_date: number;
  end_date: number;
  weekly_deadline: string | number;
  edit_key?: string;
  is_approved: boolean;
  is_setting_lineups: boolean;
  last_updated: number;
}

/**
 * Converts a TeamClient to a TeamFirestore
 *
 * @export
 * @param {TeamClient} team - The team to convert
 * @return {TeamFirestore} - The converted team
 */
export function clientToFirestore(team: TeamClient): TeamFirestore {
  const {
    uid = "",
    game_code: gameCode,
    start_date: startDate,
    end_date: endDate,
    weekly_deadline: weeklyDeadline,
    is_approved: isApproved,
    is_setting_lineups: isSettingLineups,
    last_updated: lastUpdate,
  } = team;
  return {
    uid,
    game_code: gameCode,
    start_date: startDate,
    end_date: endDate,
    weekly_deadline: weeklyDeadline,
    is_approved: isApproved,
    is_setting_lineups: isSettingLineups,
    last_updated: lastUpdate,
  };
}

export interface TeamClient {
  uid?: string;
  game_name: string;
  game_code: string;
  game_season: string;
  game_is_over: boolean;
  team_key: string;
  team_name: string;
  team_url: string;
  team_logo: string;
  league_name: string;
  num_teams: number;
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
  scoring_type: string;
  start_date: number;
  end_date: number;
  weekly_deadline: string | number;
  edit_key: string;
  is_approved: boolean;
  is_setting_lineups: boolean;
  last_updated: number;
}
