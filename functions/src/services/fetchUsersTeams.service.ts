import { TeamClient } from "../interfaces/team";
import { getAllStandings } from "./yahooAPI.service";

/**
 * Get the user's teams from the Yahoo API
 *
 * @export
 * @async
 * @param {string} uid The firebase uid
 * @return {Promise<TeamClient[]>} The user's teams
 */
export async function fetchTeamsYahoo(uid: string): Promise<TeamClient[]> {
  const teams: TeamClient[] = [];
  const standings = await getAllStandings(uid);
  const gamesJSON = standings.fantasy_content.users[0].user[1].games;
  // console.log(games); //use this to debug the JSON object and see all data
  // Loop through each "game" (nfl, nhl, nba, mlb)
  for (const key in gamesJSON) {
    if (key !== "count") {
      const game = gamesJSON[key].game[0];
      const leagues = gamesJSON[key].game[1].leagues;
      // Loop through each league within the game
      // TODO: Make this more robust with the help of the getChild function
      for (const key in leagues) {
        if (key !== "count") {
          const allTeams = leagues[key].league[1].standings[0].teams;
          const usersTeam = getUsersTeam(allTeams);
          const teamObj: TeamClient = {
            game_name: game.name,
            game_code: game.code,
            game_season: game.season,
            game_is_over: game.is_game_over,
            team_key: usersTeam.team[0][0].team_key,
            team_name: usersTeam.team[0][2].name,
            team_url: usersTeam.team[0][4].url,
            team_logo: usersTeam.team[0][5].team_logos[0].team_logo.url,
            league_name: leagues[key].league[0].name,
            num_teams: leagues[key].league[0].num_teams,
            rank: usersTeam.team[2].team_standings.rank,
            points_for: usersTeam.team[2].team_standings.points_for,
            points_against: usersTeam.team[2].team_standings.points_against,
            points_back: usersTeam.team[2].team_standings.points_back,
            outcome_totals: usersTeam.team[2].team_standings.outcome_totals,
            scoring_type: leagues[key].league[0].scoring_type,
            start_date: Date.parse(leagues[key].league[0].start_date),
            end_date: Date.parse(leagues[key].league[0].end_date),
            weekly_deadline: leagues[key].league[0].weekly_deadline,
            edit_key: leagues[key].league[0].edit_key,
            is_approved: true,
            is_setting_lineups: false,
            last_updated: -1,
          };
          teams.push(teamObj);
        }
      }
    }
  }
  // console.log("Fetched teams from Yahoo API:");
  // console.log(teams);
  return teams;
}

/**
 * Find the team managed by the current login
 * @param {*} allTeams - an object containing all teams in the league
 * @return {*} an object containing just the user's team
 */
function getUsersTeam(allTeams: any): any {
  // TODO: Could remove this by changing the API call to return the user's team
  for (const key in allTeams) {
    if (key !== "count" && allTeams[key].team[0][3].is_owned_by_current_login) {
      return allTeams[key];
    }
  }
}
