import { IPlayer } from "../../interfaces/IPlayer.js";
import { ITeamOptimizer } from "../../interfaces/ITeam.js";
import {
  getChild,
  getPacificEndOfDay,
  getPacificStartOfDay,
  parseStringToInt,
} from "../utilities.service.js";
import { getRostersByTeamID } from "./yahooAPI.service.js";
import getPlayersFromRoster from "./yahooPlayerProcessing.service.js";
import {
  createTransactionArray,
  getGamesPlayedArray,
  getInningsPitchedArray,
  getPositionCounts,
} from "./yahooTeamProcesssing.services.js";

/**
 * Get the roster objects for the given teams
 *
 * @export
 * @async
 * @param {string[]} teamKeys The team keys
 * @param {string} uid The firebase uid of the user
 * @param {string} [date=""] The date to get the roster for. If not provided, the default "" is today's date
 * @return {Promise<ITeamOptimizer[]>} The roster objects
 */
export async function fetchRostersFromYahoo(
  teamKeys: string[],
  uid: string,
  date = ""
): Promise<ITeamOptimizer[]> {
  const result: ITeamOptimizer[] = [];

  if (teamKeys.length === 0) {
    return result;
  }

  const yahooJSON = await getRostersByTeamID(teamKeys, uid, date);
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
      const usersTeamRoster = getChild(usersTeam, "roster");
      const isEditable = usersTeamRoster.is_editable;
      if (!isEditable) {
        // skip this team if it is not editable
        continue;
      }
      const coverageType = usersTeamRoster.coverage_type;
      // save the position counts to a map
      const rosterPositions = getPositionCounts(leaguesJSON, leagueKey);
      const players: IPlayer[] = getPlayersFromRoster(
        usersTeamRoster[0].players
      );
      const gamesPlayedArray = getGamesPlayedArray(usersTeam);
      const inningsPitchedArray = getInningsPitchedArray(usersTeam);

      // TODO: Could add max/current adds condtionally as well
      const rosterObject: ITeamOptimizer = {
        team_key: getChild(usersTeam[0], "team_key"),
        team_name: getChild(usersTeam[0], "name"),
        league_name: getChild(league, "name"),
        players: players,
        coverage_type: coverageType,
        coverage_period: usersTeamRoster[coverageType],
        weekly_deadline: getChild(league, "weekly_deadline"),
        edit_key: getChild(league, "edit_key"),
        game_code: getChild(gameJSON, "code"),
        num_teams: getChild(league, "num_teams"),
        roster_positions: rosterPositions,
        scoring_type: getChild(usersTeam[0], "scoring_type"),
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
        start_date: getPacificStartOfDay(getChild(league, "start_date")),
        end_date: getPacificEndOfDay(getChild(league, "end_date")),
        faab_balance: parseStringToInt(getChild(usersTeam[0], "faab_balance")),
        waiver_rule: getChild(leagueSettings, "waiver_rule"),
        transactions: createTransactionArray(
          getChild(usersTeam, "transactions")
        ),
        ...(gamesPlayedArray && { games_played: gamesPlayedArray }),
        ...(inningsPitchedArray && { innings_pitched: inningsPitchedArray }),
      };
      result.push(rosterObject);
    }
  }
  // logger.log("Fetched rosters from Yahoo API:");
  // console.log(JSON.stringify(result));
  return result;
}
