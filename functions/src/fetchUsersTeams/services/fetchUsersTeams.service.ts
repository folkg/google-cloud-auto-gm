import { ITeamAngular } from "../../common/interfaces/ITeam";
import {
  getChild,
  getPacificEndOfDay,
  getPacificStartOfDay,
  parseStringToInt,
} from "../../common/services/utilities.service";
import { getUsersTeams } from "../../common/services/yahooAPI/yahooAPI.service";

/**
 * Get the user's teams from the Yahoo API
 *
 * @export
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<ITeamAngular[]>} The user's teams
 */
export async function fetchTeamsYahoo(uid: string): Promise<ITeamAngular[]> {
  const result: ITeamAngular[] = [];

  const yahooJSON = await getUsersTeams(uid);
  const gamesJSON = getChild(yahooJSON.fantasy_content.users[0].user, "games");

  // Loop through each "game" (nfl, nhl, nba, mlb)
  for (const gameKey of Object.keys(gamesJSON).filter(
    (key) => key !== "count"
  )) {
    const gameJSON = gamesJSON[gameKey].game;
    const leaguesJSON = getChild(gameJSON, "leagues");

    // Loop through each league within the game
    for (const leagueKey of Object.keys(leaguesJSON).filter(
      (key) => key !== "count"
    )) {
      const league = leaguesJSON[leagueKey].league;
      const leagueSettings = getChild(league, "settings");
      const usersTeam = getChild(league, "teams")[0].team;
      const teamStandings = getChild(usersTeam, "team_standings");

      const teamObj: ITeamAngular = {
        game_name: getChild(gameJSON, "name"),
        game_code: getChild(gameJSON, "code"),
        game_season: getChild(gameJSON, "season"),
        game_is_over: getChild(gameJSON, "is_game_over"),
        team_key: getChild(usersTeam[0], "team_key"),
        team_name: getChild(usersTeam[0], "name"),
        team_url: getChild(usersTeam[0], "url"),
        team_logo: getChild(usersTeam[0], "team_logos")[0].team_logo.url,
        league_name: getChild(league, "name"),
        num_teams: getChild(league, "num_teams"),
        rank: teamStandings.rank,
        points_for: teamStandings.points_for,
        points_against: teamStandings.points_against,
        points_back: teamStandings.points_back,
        outcome_totals: teamStandings.outcome_totals,
        scoring_type: getChild(league, "scoring_type"),
        start_date: getPacificStartOfDay(getChild(league, "start_date")),
        end_date: getPacificEndOfDay(getChild(league, "end_date")),
        weekly_deadline: getChild(league, "weekly_deadline"),
        waiver_rule: getChild(leagueSettings, "waiver_rule"),
        faab_balance: parseStringToInt(getChild(usersTeam[0], "faab_balance")),
        current_weekly_adds: parseStringToInt(
          getChild(usersTeam[0], "roster_adds").value,
          0
        ),
        current_season_adds: parseStringToInt(
          getChild(usersTeam[0], "number_of_moves"),
          0
        ),
        max_weekly_adds: parseStringToInt(
          getChild(leagueSettings, "max_weekly_adds")
        ),
        max_season_adds: parseStringToInt(getChild(leagueSettings, "max_adds")),
        max_games_played: parseStringToInt(
          getChild(leagueSettings, "max_games_played")
        ),
        max_innings_pitched: parseStringToInt(
          getChild(leagueSettings, "max_innings_pitched")
        ),
        edit_key: getChild(league, "edit_key"),
      };
      result.push(teamObj);
    }
  }

  return result;
}
