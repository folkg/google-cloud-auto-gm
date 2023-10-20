import { IPlayer } from "../../interfaces/IPlayer.js";
import { getChild } from "../utilities.service.js";
import {
  AvailabilityStatus,
  PlayerSort,
  getTopAvailablePlayers,
} from "./yahooAPI.service.js";
import getPlayersFromRoster from "./yahooPlayerProcessing.service.js";

export type TopAvailablePlayers = {
  [teamKey: string]: IPlayer[];
};

/**
 * Fetches the top available players from Yahoo API for a given league.
 *
 * @export
 * @async
 * @param {string} teamKeys - The league key
 * @param {string} uid - The user ID
 * @param {AvailabilityStatus} [availabilityStatus="A"] - The availability status of the players to fetch
 * @param {PlayerSort} [sort="sort=R_PO"] - The sort order of the players to fetch
 * @return {Promise<TopAvailablePlayers>} - A map of teamKeys' Top Available Players in an array
 */
export async function fetchTopAvailablePlayersFromYahoo(
  teamKeys: string[],
  uid: string,
  availabilityStatus: AvailabilityStatus = "A",
  sort: PlayerSort = "sort=R_PO"
): Promise<TopAvailablePlayers> {
  if (teamKeys.length === 0) {
    return {};
  }

  const result: TopAvailablePlayers = {};

  // create a map of leagueKeys to teamKeys
  const mapLeagueToTeam: { [key: string]: string } = {};
  teamKeys.forEach((teamKey) => {
    const leagueKey = teamKey.split(".t")[0];
    mapLeagueToTeam[leagueKey] = teamKey;
  });

  const yahooJSON = await getTopAvailablePlayers(
    teamKeys,
    uid,
    availabilityStatus,
    sort
  );
  if (!yahooJSON) {
    return result; // return empty result if yahooJSON is null, this is primarily for testing
  }
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
      const yahooLeagueKey = getChild(
        leaguesJSON[leagueKey].league,
        "league_key"
      );
      const teamKey = mapLeagueToTeam[yahooLeagueKey];
      const league = leaguesJSON[leagueKey].league;
      const players = getChild(league, "players");

      result[teamKey] = getPlayersFromRoster(players);
    }
  }
  // logger.log("Fetched rosters from Yahoo API:");
  // console.log(JSON.stringify(result));
  return result;
}
