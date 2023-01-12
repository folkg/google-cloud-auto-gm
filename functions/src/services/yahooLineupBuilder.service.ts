import * as functions from "firebase-functions";
import { httpGet } from "./yahooHttp.service";
import { getChild } from "./utilities.service";
import { Player, Roster } from "../interfaces/roster";

/**
 * A function to build the roster object for a team
 *
 * @export
 * @async
 * @param {string} games
 * @param {string} uid
 * @return {Promise<any>}
 */
export async function fetchRostersFromYahoo(
  games: string,
  uid: string
): Promise<Roster[]> {
  try {
    const yahooRostersJSON = await getRostersByGameID(games, uid);

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
              // TODO: Uncomment this. Commented out for testing.
              // continue;
            }
            const coverageType = usersTeamRoster.coverage_type;
            // save the position counts to a map
            // TODO: Finish the position counts and dummy roster spots
            const positionCounter: any = getPositionCounts(leaguesJSON, key);
            const players: Player[] = getPlayersFromRoster(
              usersTeamRoster[0].players,
              positionCounter
            );
            // Add a dummy player for every unfilled position in the roster
            const dummyPlayers: Player[] = fillDummyPlayers(positionCounter);
            // add all dummyPlayers to players
            players.push(...dummyPlayers);

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
            };
            rosters.push(rosterObj);
          }
        }
      }
    }
    console.log("Fetched rosters from Yahoo API:");
    return rosters;
    // return yahooRostersJSON;
  } catch (err) {
    console.log(err);
    throw new functions.https.HttpsError("internal", "Error: " + err);
  }
}

/**
 * Will get the JSON response from Yahoo for all teams matching the GameIDs
 * This will be useful if we want to gget rosters for all teams for a sport
 *
 * @async
 * @param {string} games - comma separated string of gameIDs ie "nfl","nfl,nhl"
 * @param {string} uid - The firebase uid
 * @return {Promise<any>} The Yahoo JSON object containing the rosters
 */
async function getRostersByGameID(games: string, uid: string): Promise<any> {
  // Could add the following API options if desired
  // cut_types=diamond
  // ranks=o-rank,last7days,last14days,last30days,
  // projected_next7days,projected_next14days,projected_week
  const url =
    "users;use_login=1/games;game_keys=" +
    games +
    "/leagues;out=settings/teams/roster" +
    "/players;out=percent_started,percent_owned,ranks,opponent," +
    "transactions,starting_status" +
    ";ranks=projected_next7days,projected_week" +
    ";percent_started.cut_types=diamond" +
    ";percent_owned.cut_types=diamond" +
    ";transaction.cut_types=diamond" +
    "?format=json";

  try {
    return await httpGet(url, uid);
  } catch (error) {
    console.log("Error fetching rosters from Yahoo API:");
    console.log(error);
    throw new functions.https.HttpsError(
      "internal",
      "Communication with Yahoo failed: " + error
    );
  }
}

/**
 *
 *
 * @param {*} leaguesJSON
 * @param {string} key
 * @return {*}
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
 * @param {*} positionCounter - A map of positions and the number of players
 * @return {Player[]} - An array of Player objects
 */
function getPlayersFromRoster(
  playersJSON: any,
  positionCounter: any
): Player[] {
  // TODO: Refactor to pull out some functions for readability
  const players: Player[] = [];

  for (const key in playersJSON) {
    if (key !== "count") {
      const player = playersJSON[key].player;
      // Loop through the eligible_positions array
      let eligiblePositions = "";
      getChild(player[0], "eligible_positions").forEach((position: any) => {
        eligiblePositions += position.position;
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
        is_editable: getChild(player, "is_editable"),
        is_playing: !opponent || opponent === "Bye" ? false : true,
        injury_status: getChild(player[0], "status_full"),
        percent_started: percentStarted,
        percent_owned: percentOwned,
        transactions_delta: transactionDelta,
        is_starting:
          getChild(getChild(player[0], "starting_status"), "is_starting") ||
          "N/A",
        rank_next7days: rankNext7Days,
        rank_projected_week: rankProjectedWeek,
        score: 0,
      };

      // Decrement the player's selected position from the allowable total
      // At the end positionCounter will hold the number of unfilled positions
      positionCounter[playerObj.selected_position]--;

      // push the player to the object
      players.push(playerObj);
    }
  }
  return players;
}

/**
 * Description placeholder
 * @date 2023-01-11 - 8:51:14 p.m.
 *
 * @param {*} positionCounter
 * @return {{}}
 */
function fillDummyPlayers(positionCounter: any) {
  const dummyPlayers: Player[] = [];
  // TODO: Maybe want to count the number of unused roster spots here as well?
  // Or maybe in a different function.
  // eslint-disable-next-line guard-for-in
  for (const position in positionCounter) {
    const count = positionCounter[position];
    if (position !== "BN" && count > 0) {
      for (let i = 0; i < count; i++) {
        const dummyObj: Player = {
          player_key: "",
          player_name: "",
          eligible_positions: "",
          selected_position: position,
          is_editable: true,
          is_playing: false,
          injury_status: "",
          percent_started: 0,
          percent_owned: 0,
          transactions_delta: 0,
          is_starting: "N/A",
          rank_next7days: -1,
          rank_projected_week: -1,
          score: 0,
        };
        dummyPlayers.push(dummyObj);
      } // end for i loop
    } // end if
  } // end for position loop
  return dummyPlayers;
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

// /**
//  * Will get the JSON response from Yahoo for all teams matching the TeamIDs
//  * This will be useful if we want to get for just individual teams
//  *
//  * @async
//  * @param {string} teams - comma separated string of teamIDs, ie.
//  * "414.l.240994.t.12, 414.l.358976.t.4, 419.l.14950.t.2,
//  * 419.l.19947.t.6,419.l.28340.t.1,419.l.59985.t.12"
//  * @param {string} uid - The firebase uid
//  * @return {Promise<any>} The Yahoo JSON object containing the rosters
//  */
// async function getRostersByTeamID(teams: string, uid: string): Promise<any> {
//   // TODO: Make this a loop to get all teams if there are commas in string
//   let leagueKeys = "";
//   if (teams.includes(",")) {
//     // TODO: If split creates an array of one if there is no comma, simplify
//     const teamKeys: string[] = teams.split(",");
//     for (const teamKey of teamKeys) {
//       leagueKeys += teamKey.split(".t.", 1)[0] + ",";
//     }
//     // Remove trailing comma from final leagueKeys string
//     leagueKeys = leagueKeys.slice(0, -1);
//   } else {
//     leagueKeys = teams.split(".t.", 1)[0];
//   }
//   const url =
//     "users;use_login=1/games;game_keys=nhl,nfl,nba,mlb" +
//     "/leagues;league_keys=" +
//     leagueKeys +
//     ";out=settings/teams/roster" +
//     "/players;out=percent_started,percent_owned,ranks,opponent," +
//     "transactions,starting_status" +
//     ";ranks=projected_next7days,projected_week" +
//     ";percent_started.cut_types=diamond" +
//     ";percent_owned.cut_types=diamond" +
//     ";transaction.cut_types=diamond" +
//     "?format=json";

//   try {
//     return await httpGet(url, uid);
//   } catch (error) {
//     console.log("Error fetching rosters from Yahoo API:");
//     console.log(error);
//     throw new functions.https.HttpsError(
//       "internal",
//       "Communication with Yahoo failed: " + error
//     );
//   }
// }
