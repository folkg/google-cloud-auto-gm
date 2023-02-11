import { Player } from "../interfaces/roster";
import { HEALTHY_STATUS_LIST } from "../helpers/constants";
import { NHL_STARTING_GOALIES } from "./yahooStartingGoalie.service";

/**
 * Returns the proper score function used to compare players to other players
 * on the same fantasy roster based on the league settings
 *
 * @export
 * @async
 * @param {string} gameCode - The game code for the league
 * @param {string} weeklyDeadline - The weekly deadline for the league
 * @return {()} - A function that takes a player and returns a score.
 */
export async function assignPlayerScoreFunction(
  gameCode: string,
  weeklyDeadline: string
) {
  let playerScoreFunction: (player: Player) => number;
  if (gameCode === "nfl") {
    playerScoreFunction = nflScoreFunction();
  } else if (weeklyDeadline && weeklyDeadline !== "intraday") {
    // weeklyDeadline will be something like "1" to represent Monday
    playerScoreFunction = weeklyLineupScoreFunction();
  } else if (gameCode === "nhl") {
    playerScoreFunction = await nhlScoreFunction();
  } else {
    playerScoreFunction = dailyScoreFunction();
  }
  return playerScoreFunction;
}

/**
 * Default score function used to compare players.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function dailyScoreFunction(): (player: Player) => number {
  return (player: Player) => {
    const NOT_PLAYING_FACTOR = 0.0001;
    const NOT_STARTING_FACTOR = 0.01;
    // The score will be percent_started
    // TODO: is_starting to be more specific (basketball G, baseball players)
    // Maybe boost the score of players who are starting instead of penalizing?
    let score = player.percent_started;
    if (!player.is_playing) {
      // If a player is not playing, set their score to a minimal value
      score *= NOT_PLAYING_FACTOR;
    } else if (
      player.is_starting === 0 ||
      !HEALTHY_STATUS_LIST.includes(player.injury_status)
    ) {
      // If a player is not starting or hurt, factor their score such that it
      // falls below all healthy players, but above players not playing.
      score *= NOT_STARTING_FACTOR;
    }
    return score;
  };
}
/**
 * Score function used to compare players in NHL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export async function nhlScoreFunction(): Promise<(player: Player) => number> {
  const starters = await NHL_STARTING_GOALIES;
  return (player: Player) => {
    const NOT_PLAYING_FACTOR = 0.0001;
    const NOT_STARTING_FACTOR = 0.01;
    const STARTING_FACTOR = 100;
    // The score will be percent_started
    let score = player.percent_started;
    const isPlayerInjured = !HEALTHY_STATUS_LIST.includes(player.injury_status);
    const isStartingGoalie = player.eligible_positions.includes("G")
      ? checkStartingGoalie()
      : false;
    if (!player.is_playing) {
      score *= NOT_PLAYING_FACTOR;
    } else if (isPlayerInjured) {
      score *= NOT_STARTING_FACTOR;
    } else if (isStartingGoalie) {
      score *= STARTING_FACTOR;
    }
    return score;

    /**
     * Checks if the player is a starting goalie
     *
     * @return {boolean} - Whether the player is a starting goalie or not
     */
    function checkStartingGoalie(): boolean {
      if (starters.length === 0) {
        // default to is_starting flag if we can't get the starting goalies
        return player.is_starting === 1;
      }
      if (starters.findIndex((g) => g === player.player_key) === -1) {
        return false;
      }
      return true;
    }
  };
}
/**
 * Score function used to compare players in NFL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function nflScoreFunction(): (player: Player) => number {
  return (player: Player) => {
    const NOT_PLAYING_FACTOR = 0.0001;
    const NOT_STARTING_FACTOR = 0.01;
    // The score will be percent_started / rank_projected_week
    // TODO: Does rank_projected_week factor in injury status already?
    // Are we double counting?
    let score = (player.percent_started / player.rank_projected_week) * 100;
    if (!player.is_playing) {
      // If a player is not playing, set their score to a minimal value
      score *= NOT_PLAYING_FACTOR;
    } else if (!HEALTHY_STATUS_LIST.includes(player.injury_status)) {
      // If a player is not starting or hurt, factor their score such that it
      // falls below all healthy players, but above players not playing.
      score *= NOT_STARTING_FACTOR;
    }

    return score;
  };
}
/**
 * Score function used to compare players in leagues that need their lineups
 * set weekly.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 */
export function weeklyLineupScoreFunction(): (player: Player) => number {
  return (player: Player) => {
    // The score will be the inverse of their projected rank for the next week
    // We will not factor in injury status as Yahoo has already accounted for it
    const score = 100 / player.rank_next7days;
    return score;
  };
}
