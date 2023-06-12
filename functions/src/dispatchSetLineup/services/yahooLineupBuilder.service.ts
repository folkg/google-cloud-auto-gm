import { IPlayer } from "../../common/interfaces/IPlayer.js";
import {
  GamesPlayed,
  ITeamOptimizer,
  InningsPitched,
} from "../../common/interfaces/ITeam.js";
import {
  getChild,
  getPacificEndOfDay,
  getPacificStartOfDay,
  parseStringToInt,
} from "../../common/services/utilities.service.js";
import { getRostersByTeamID } from "../../common/services/yahooAPI/yahooAPI.service.js";
import getPlayersFromRoster from "./yahooPlayerProcessing.service.js";

/**
 * Get the roster objects for the given teams
 *
 * @export
 * @async
 * @param {string[]} teams The team keys
 * @param {string} uid The firebase uid of the user
 * @param {string} [date=""] The date to get the roster for. If not provided, the default "" is today's date
 * @return {Promise<ITeamOptimizer[]>} The roster objects
 */
export async function fetchRostersFromYahoo(
  teams: string[],
  uid: string,
  date = ""
): Promise<ITeamOptimizer[]> {
  const result: ITeamOptimizer[] = [];

  const yahooJSON = await getRostersByTeamID(teams, uid, date);
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

function createTransactionArray(transactions: any): any[] {
  const result: any[] = [];
  if (!transactions) return result;

  Object.keys(transactions).forEach((key) => {
    if (key !== "count") {
      result.push(transactions[key].transaction);
    }
  });
  return result;
}

function getGamesPlayedArray(usersTeam: any): GamesPlayed[] | undefined {
  return getChild(usersTeam, "games_played")
    ?.find(
      (element: any) =>
        element.games_played_by_position_type.position_type !== "P"
    )
    ?.games_played_by_position_type.games_played?.map(
      (element: any) => element.games_played_by_position
    );
}

function getInningsPitchedArray(usersTeam: any): InningsPitched | undefined {
  return getChild(usersTeam, "games_played")?.find(
    (element: any) =>
      element.games_played_by_position_type.position_type === "P"
  )?.games_played_by_position_type.innings_pitched;
}

/**
 * Get the position counts from the leagues JSON object
 *
 * @param {*} leaguesJSON - The leagues JSON object
 * @param {string} key - The key of the league
 * @return {*} - A map of positions and the number of players
 */
function getPositionCounts(leaguesJSON: any, key: string) {
  const result: { [key: string]: number } = {};

  getChild(leaguesJSON[key].league, "settings")[0].roster_positions.forEach(
    (position: any) => {
      result[position.roster_position.position] = parseInt(
        position.roster_position.count
      );
    }
  );

  return result;
}
