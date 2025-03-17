import type { GamesPlayed, InningsPitched } from "../../interfaces/ITeam.js";
import { getChild } from "../utilities.service.js";

// TOOD: ArkType
export function createTransactionArray(transactions: unknown): unknown[] {
  const result: unknown[] = [];
  if (!transactions) {
    return result;
  }

  for (const key in transactions) {
    if (key !== "count") {
      result.push(transactions[key].transaction);
    }
  }
  return result;
}

// TOOD: ArkType
export function getGamesPlayedArray(
  usersTeam: unknown,
): GamesPlayed[] | undefined {
  return getChild(usersTeam, "games_played")
    ?.find(
      (element) => element.games_played_by_position_type.position_type !== "P",
    )
    ?.games_played_by_position_type.games_played?.map(
      (element) => element.games_played_by_position,
    );
}

// TOOD: ArkType
export function getInningsPitchedArray(
  usersTeam: unknown,
): InningsPitched | undefined {
  return getChild(usersTeam, "games_played")?.find(
    (element) => element.games_played_by_position_type.position_type === "P",
  )?.games_played_by_position_type.innings_pitched;
}

/**
 * Get the position counts from the leagues JSON object
 *
 * @param {*} leaguesJSON - The leagues JSON object
 * @param {string} key - The key of the league
 * @return {*} - A map of positions and the number of players
 */
export function getPositionCounts(leaguesJSON: unknown, key: string) {
  const result: { [key: string]: number } = {};

  // TOOD: ArkType
  for (const position of getChild(leaguesJSON[key].league, "settings")[0]
    .roster_positions) {
    result[position.roster_position.position] = Number.parseInt(
      position.roster_position.count,
    );
  }

  return result;
}
