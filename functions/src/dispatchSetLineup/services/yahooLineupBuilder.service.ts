import { getChild } from "../../common/services/utilities.service";
import { Player, Roster } from "../interfaces/roster";
import { getRostersByTeamID } from "../../common/services/yahooAPI/yahooAPI.service";

/**
 * Get the roster objects for the given teams
 *
 * @export
 * @async
 * @param {string[]} teams The team keys
 * @param {string} uid The firebase uid of the user
 * @return {Promise<Roster[]>} The roster objects
 */
export async function fetchRostersFromYahoo(
  teams: string[],
  uid: string
): Promise<Roster[]> {
  const yahooRostersJSON = await getRostersByTeamID(teams, uid);
  const rosters: Roster[] = [];
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
          const rosterPositions: { [key: string]: number } = getPositionCounts(
            leaguesJSON,
            key
          );
          const players: Player[] = getPlayersFromRoster(
            usersTeamRoster[0].players
          );

          const rosterObj: Roster = {
            team_key: getChild(usersTeam.team[0], "team_key"),
            players: players,
            coverage_type: coverageType,
            coverage_period: usersTeamRoster[coverageType],
            weekly_deadline: getChild(
              leaguesJSON[key].league,
              "weekly_deadline"
            ),
            game_code: getChild(gameJSON, "code"),
            roster_positions: rosterPositions,
          };
          rosters.push(rosterObj);
        }
      }
    }
  }
  // console.log("Fetched rosters from Yahoo API:");
  return rosters;
}

/**
 * Get the position counts from the leagues JSON object
 *
 * @param {*} leaguesJSON - The leagues JSON object
 * @param {string} key - The key of the league
 * @return {*} - A map of positions and the number of players
 */
function getPositionCounts(leaguesJSON: any, key: string) {
  const positionCounter: any = {};
  getChild(leaguesJSON[key].league, "settings")[0].roster_positions.forEach(
    (position: any) => {
      positionCounter[position.roster_position.position] = parseInt(
        position.roster_position.count
      );
    }
  );
  return positionCounter;
}

/**
 * Deconstruct the players JSON object to get the required properties
 *
 * @param {*} playersJSON - The players JSON object
 * @param {*} emptyPositions - A map of positions and the number of players
 * @return {Player[]} - An array of Player objects
 */
function getPlayersFromRoster(playersJSON: any): Player[] {
  const players: Player[] = [];

  // eslint-disable-next-line guard-for-in
  for (const key in playersJSON) {
    if (key !== "count") {
      const player = playersJSON[key].player;
      // Loop through the eligible_positions array
      const eligiblePositions: string[] = [];
      getChild(player[0], "eligible_positions").forEach((position: any) => {
        eligiblePositions.push(position.position);
      });

      // get the player's opponent
      const opponent = getChild(player, "opponent");

      // pull the percent_started and percent_owned out of the JSON
      const percentStarted = getDiamondPCT(player, "percent_started");
      const percentOwned = getDiamondPCT(player, "percent_owned");

      // pull the player ranks out of the JSON
      const { rankNext7Days, rankProjectedWeek } = getPlayerRanks(player);

      // pull the transaction delta out of the JSON
      const transactionDelta = getTransactions(player);
      // Build the player object
      const playerObj: Player = {
        player_key: getChild(player[0], "player_key"),
        player_name: getChild(player[0], "name").full,
        eligible_positions: eligiblePositions,
        selected_position: getChild(
          getChild(player, "selected_position"),
          "position"
        ),
        is_editable: getChild(player, "is_editable") === 1 ? true : false,
        is_playing: !opponent || opponent === "Bye" ? false : true,
        injury_status: getChild(player[0], "status_full") || "Healthy",
        percent_started: percentStarted,
        percent_owned: percentOwned,
        transactions_delta: transactionDelta,
        is_starting: getChild(player, "starting_status")
          ? getChild(getChild(player, "starting_status"), "is_starting")
          : "N/A",
        rank_next7days: rankNext7Days,
        rank_projected_week: rankProjectedWeek,
        score: 0,
      };

      // push the player to the object
      players.push(playerObj);
    }
  }
  return players;
}

/**
 * Will get the diamond cut value for the percent started or percent owned
 *
 * @param {*} player - The player JSON object
 * @param {string} pctType - The type of percent to get
 * (percent_started or percent_owned)
 * @return {number} - The diamond cut value
 */
function getDiamondPCT(player: any, pctType: string): number {
  let returnPCT = 0;
  const pSCuts = getChild(getChild(player, pctType), pctType + "_cut_types");
  pSCuts.forEach((cutType: any) => {
    const cutTypeObj = cutType[pctType + "_cut_type"];
    if (getChild(cutTypeObj, "cut_type") === "diamond") {
      returnPCT = getChild(cutTypeObj, "value");
    }
  });
  return returnPCT;
}

/**
 * Will get the player ranks for the player
 *
 * @param {*} player - The player JSON object
 * @return {*} - The player ranks
 */
function getPlayerRanks(player: any) {
  let rankNext7Days = -1;
  let rankProjectedWeek = -1;
  getChild(player, "player_ranks").forEach((rank: any) => {
    if (rank.player_rank.rank_type === "PS7") {
      rankNext7Days = parseInt(rank.player_rank.rank_value) || -1;
    } else if (rank.player_rank.rank_type === "PW") {
      rankProjectedWeek = parseInt(rank.player_rank.rank_value) || -1;
    }
  });
  return { rankNext7Days, rankProjectedWeek };
}

/**
 * Will get the transaction delta for the player
 *
 * @param {*} player - The player JSON object
 * @return {number} - The transaction delta
 */
function getTransactions(player: any): number {
  let transactionDelta = 0;
  getChild(player, "transactions").cut_types.forEach((cutType: any) => {
    const cutTypeObj = cutType.cut_type;
    if (cutTypeObj.type === "diamond") {
      transactionDelta = parseInt(cutTypeObj.adds) - parseInt(cutTypeObj.drops);
    }
  });
  return transactionDelta;
}
