import { Player } from "../interfaces/Player";
import { HEALTHY_STATUS_LIST } from "../helpers/constants";
import { getNHLStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";

/**
 * Returns the proper score function used to compare players on the same
 * fantasy roster in order to decide who to start and who to sit.
 *
 * @export
 * @async
 * @param {string} gameCode - The game code for the league
 * @param {string} weeklyDeadline - The weekly deadline for the league
 * @return {()} - A function that takes a player and returns a score.
 */
export function assignPlayerStartScoreFunction(
  gameCode: string,
  weeklyDeadline: string
) {
  if (gameCode === "nfl") {
    return nflScoreFunction();
  } else if (weeklyDeadline && weeklyDeadline !== "intraday") {
    // weeklyDeadline will be something like "1" to represent Monday
    return weeklyLineupScoreFunction();
  } else if (gameCode === "nhl") {
    return nhlScoreFunction();
  }
  return dailyScoreFunction();
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
    const PENALTY_FACTOR = 0.01;
    // The score will be percent_started
    // TODO: is_starting to be more specific (basketball G, baseball players)
    // Maybe boost the score of players who are starting instead of penalizing?
    let score = player.percent_started;
    if (!score) {
      // percent_started has been broken before, so this is a backup
      score = player.percent_owned;
    }
    if (!player.is_playing) {
      // If a player is not playing, set their score to a minimal value
      score *= PENALTY_FACTOR;
    }
    if (
      player.is_starting === 0 ||
      !HEALTHY_STATUS_LIST.includes(player.injury_status)
    ) {
      // If a player is not starting or hurt, factor their score such that it
      // falls below all healthy players, but above players not playing.
      score *= PENALTY_FACTOR;
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
export function nhlScoreFunction(): (player: Player) => number {
  const starters = getNHLStartingGoalies() ? getNHLStartingGoalies() : [];
  return (player: Player) => {
    const PENALTY_FACTOR = 0.01;
    const STARTING_FACTOR = 100;
    // The score will be percent_started
    let score = player.percent_started;
    if (!score) {
      // percent_started has been broken before, so this is a backup
      score = player.percent_owned;
    }
    const isPlayerInjured = !HEALTHY_STATUS_LIST.includes(player.injury_status);
    const isStartingGoalie = player.eligible_positions.includes("G")
      ? checkStartingGoalie()
      : false;
    if (!player.is_playing) {
      score *= PENALTY_FACTOR;
    }
    if (isPlayerInjured) {
      score *= PENALTY_FACTOR;
    }
    if (isStartingGoalie) {
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
    const PENALTY_FACTOR = 0.01;
    // The score will be percent_started / rank_projected_week
    // TODO: Does rank_projected_week factor in injury status already?
    // Are we double counting?
    let score = player.percent_started;
    if (!score) {
      // percent_started has been broken before, so this is a backup
      score = player.percent_owned;
    }
    score = (score / player.rank_projected_week) * 100;
    if (!player.is_playing) {
      // If a player is not playing, set their score to a minimal value
      score *= PENALTY_FACTOR;
    }
    if (!HEALTHY_STATUS_LIST.includes(player.injury_status)) {
      // If a player is not starting or hurt, factor their score such that it
      // falls below all healthy players, but above players not playing.
      score *= PENALTY_FACTOR;
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
