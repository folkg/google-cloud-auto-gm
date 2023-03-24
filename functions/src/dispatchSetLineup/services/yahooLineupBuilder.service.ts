import { getChild } from "../../common/services/utilities.service";
import { Team } from "../interfaces/Team";
import { IPlayer, PlayerRanks } from "../interfaces/IPlayer";
import { getRostersByTeamID } from "../../common/services/yahooAPI/yahooAPI.service";

/**
 * Get the roster objects for the given teams
 *
 * @export
 * @async
 * @param {string[]} teams The team keys
 * @param {string} uid The firebase uid of the user
 * @param {string} [date=""] The date to get the roster for. If not provided, the default "" is today's date
 * @return {Promise<Team[]>} The roster objects
 */
export async function fetchRostersFromYahoo(
  teams: string[],
  uid: string,
  date = ""
): Promise<Team[]> {
  const result: Team[] = [];

  const yahooRostersJSON = await getRostersByTeamID(teams, uid, date);
  // console.log(JSON.stringify(yahooRostersJSON));
  const gamesJSON = yahooRostersJSON.fantasy_content.users[0].user[1].games;
  // console.log(games); //use this to debug the JSON object and see all data

  // Loop through each "game" (nfl, nhl, nba, mlb)
  for (const key in gamesJSON) {
    if (key !== "count") {
      const gameJSON = gamesJSON[key].game;
      const leaguesJSON = getChild(gameJSON, "leagues");
      // Loop through each league within the game
      for (const key in leaguesJSON) {
        if (key !== "count") {
          const usersTeam = getChild(leaguesJSON[key].league, "teams")[0];
          const usersTeamRoster = getChild(usersTeam.team, "roster");
          const isEditable = usersTeamRoster.is_editable;
          if (!isEditable) {
            // skip this team if it is not editable
            continue;
          }
          const coverageType = usersTeamRoster.coverage_type;
          // save the position counts to a map
          const rosterPositions = getPositionCounts(leaguesJSON, key);
          const players: IPlayer[] = getPlayersFromRoster(
            usersTeamRoster[0].players
          );

          const rosterObject: Team = {
            team_key: getChild(usersTeam.team[0], "team_key"),
            players: players,
            coverage_type: coverageType,
            coverage_period: usersTeamRoster[coverageType],
            weekly_deadline: getChild(
              leaguesJSON[key].league,
              "weekly_deadline"
            ),
            edit_key: getChild(leaguesJSON[key].league, "edit_key"),
            game_code: getChild(gameJSON, "code"),
            num_teams_in_league: getChild(leaguesJSON[key].league, "num_teams"),
            roster_positions: rosterPositions,
            current_weekly_adds: parseStringToInt(
              getChild(usersTeam.team[0], "roster_adds").value,
              0
            ),
            current_season_adds: parseStringToInt(
              getChild(usersTeam.team[0], "number_of_moves"),
              0
            ),
            max_weekly_adds: parseStringToInt(
              getChild(leaguesJSON[key].league, "settings")[0].max_weekly_adds
            ),
            max_season_adds: parseStringToInt(
              getChild(leaguesJSON[key].league, "settings")[0].max_adds
            ),
            start_date: Date.parse(
              getChild(leaguesJSON[key].league, "start_date")
            ),
            end_date: Date.parse(getChild(leaguesJSON[key].league, "end_date")),
            faab_balance: parseStringToInt(
              getChild(usersTeam.team[0], "faab_balance")
            ),
            waiver_rule: getChild(leaguesJSON[key].league, "settings")[0]
              .waiver_rule,
          };
          result.push(rosterObject);
        }
      }
    }
  }
  // console.log("Fetched rosters from Yahoo API:");
  // console.log(JSON.stringify(rosters));
  return result;
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

/**
 * Deconstruct the players JSON object to get the required properties
 *
 * @param {*} playersJSON - The players JSON object
 * @param {*} emptyPositions - A map of positions and the number of players
 * @return {IPlayer[]} - An array of Player objects
 */
function getPlayersFromRoster(playersJSON: any): IPlayer[] {
  const result: IPlayer[] = [];

  // eslint-disable-next-line guard-for-in
  for (const key in playersJSON) {
    if (key !== "count") {
      const player = playersJSON[key].player;
      const opponent = getChild(player, "opponent");

      const playerObject: IPlayer = {
        player_key: getChild(player[0], "player_key"),
        player_name: getChild(player[0], "name").full,
        eligible_positions: getEligiblePositions(player),
        selected_position: getChild(
          getChild(player, "selected_position"),
          "position"
        ),
        is_editable: getChild(player, "is_editable") === 1 ? true : false,
        is_playing: !opponent || opponent === "Bye" ? false : true,
        injury_status: getChild(player[0], "status_full") || "Healthy",
        percent_started: getPercentObject(player, "percent_started"),
        percent_owned: getPercentObject(player, "percent_owned"),
        is_starting: getChild(player, "starting_status")
          ? getChild(getChild(player, "starting_status"), "is_starting")
          : "N/A",
        ranks: getPlayerRanks(player),
        is_undroppable:
          getChild(player[0], "is_undroppable") === "1" ? true : false,
      };

      result.push(playerObject);
    }
  }

  return result;
}

function getEligiblePositions(player: any) {
  const eligiblePositions: string[] = [];
  getChild(player[0], "eligible_positions").forEach((position: any) => {
    eligiblePositions.push(position.position);
  });
  return eligiblePositions;
}

/**
 * Will get the diamond cut value for the percent started or percent owned
 *
 * @param {*} player - The player JSON object
 * @param {string} percentType - The type of percent to get
 * (percent_started or percent_owned)
 * @param {string} cut - The cut type to get (diamond, platinum, gold, silver, bronze)
 * @return {number} - The diamond cut value
 */
function getPercentObject(
  player: any,
  percentType: string,
  cut = "diamond"
): number {
  const percentObject = getChild(player, percentType);
  let result = getChild(percentObject, "value");

  // if we can get the cut type, then we will return that instead of the general value
  const percentCuts = getChild(percentObject, percentType + "_cut_types");
  percentCuts.forEach((cutType: any) => {
    const cutTypeObject = cutType[percentType + "_cut_type"];
    if (getChild(cutTypeObject, "cut_type") === cut) {
      result = getChild(cutTypeObject, "value");
    }
  });

  return result;
}

/**
 * Will get the player ranks for the player
 *
 * @param {*} player - The player JSON object
 * @return {*} - The player ranks
 */
function getPlayerRanks(player: any) {
  const result: PlayerRanks = {
    last30Days: -1,
    last14Days: -1,
    next7Days: -1,
    restOfSeason: -1,
    last4Weeks: -1,
    projectedWeek: -1,
    next4Weeks: -1,
  };
  getChild(player, "player_ranks").forEach((rank: any) => {
    switch (rank.player_rank.rank_type) {
      case "L30":
        result.last30Days = parseStringToInt(rank.player_rank.rank_value);
        break;
      case "L14":
        result.last14Days = parseStringToInt(rank.player_rank.rank_value);
        break;
      case "PS7":
        result.next7Days = parseStringToInt(rank.player_rank.rank_value);
        break;
      case "PSR":
        result.restOfSeason = parseStringToInt(rank.player_rank.rank_value);
        break;
      case "L4W":
        result.last4Weeks = parseStringToInt(rank.player_rank.rank_value);
        break;
      case "PW":
        result.projectedWeek = parseStringToInt(rank.player_rank.rank_value);
        break;
      case "PN4W":
        result.next4Weeks = parseStringToInt(rank.player_rank.rank_value);
        break;
    }
  });
  return result;
}

function parseStringToInt(value: string, defaultValue = -1): number {
  return parseInt(value) || defaultValue;
}
