import { IPlayer } from "../../common/interfaces/IPlayer.js";
import { getChild } from "../../common/services/utilities.service.js";
import { getTopAvailablePlayers } from "../../common/services/yahooAPI/yahooAPI.service.js";
import { getPlayersFromRoster } from "./yahooLineupBuilder.service.js";

/**
 * Fetches the top available players from Yahoo API for a given league.
 *
 * @export
 * @async
 * @param {string} leagueKey - The league key
 * @param {string} uid - The user ID
 * @param {string} [availabilityStatus="A"] - The availability status of the players to fetch.
 * Defaults to "A" (all available players). Other options are "FA" (free agents) and "W" (waivers).
 * @return {Promise<IPlayer[]>} - An array of Player objects
 */
export async function fetchTopAvailablePlayersFromYahoo(
  leagueKey: string,
  uid: string,
  availabilityStatus = "A"
): Promise<IPlayer[]> {
  const yahooJSON = await getTopAvailablePlayers(
    leagueKey,
    uid,
    availabilityStatus
  );
  const gamesJSON = getChild(yahooJSON.fantasy_content.users[0].user, "games");

  // Loop through each "game" (nfl, nhl, nba, mlb) since we don't know which one we are looking for
  for (const gameKey of Object.keys(gamesJSON).filter(
    (key) => key !== "count"
  )) {
    const gameJSON = gamesJSON[gameKey].game;
    const leaguesJSON = getChild(gameJSON, "leagues");

    // for games with no leagues, leaguesJSON is an empty array
    if (Array.isArray(leaguesJSON)) {
      continue;
    }
    const league = leaguesJSON["0"].league;
    const players = getChild(league, "players");

    return getPlayersFromRoster(players);
  }
  // logger.log("Fetched rosters from Yahoo API:");
  // console.log(JSON.stringify(result));
  return [];
}
