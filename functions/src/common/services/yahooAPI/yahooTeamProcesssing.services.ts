import { GamesPlayed, InningsPitched } from "../../interfaces/ITeam";
import { getChild } from "../utilities.service";

export function createTransactionArray(transactions: any): any[] {
  const result: any[] = [];
  if (!transactions) return result;

  Object.keys(transactions).forEach((key) => {
    if (key !== "count") {
      result.push(transactions[key].transaction);
    }
  });
  return result;
}

export function getGamesPlayedArray(usersTeam: any): GamesPlayed[] | undefined {
  return getChild(usersTeam, "games_played")
    ?.find(
      (element: any) =>
        element.games_played_by_position_type.position_type !== "P"
    )
    ?.games_played_by_position_type.games_played?.map(
      (element: any) => element.games_played_by_position
    );
}

export function getInningsPitchedArray(
  usersTeam: any
): InningsPitched | undefined {
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
export function getPositionCounts(leaguesJSON: any, key: string) {
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
