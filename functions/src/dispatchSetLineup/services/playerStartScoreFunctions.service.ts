import { IPlayer } from "../interfaces/IPlayer";
import { HEALTHY_STATUS_LIST } from "../helpers/constants";
import {
  getMLBStartingPitchers,
  getNHLStartingGoalies,
} from "../../common/services/yahooAPI/yahooStartingPlayer.service";

const NOT_PLAYING_FACTOR = 0.001;
const INJURY_FACTOR = 0.01;
const STARTING_FACTOR = 100;
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
export function playerStartScoreFunctionFactory(
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
  } else if (gameCode === "mlb") {
    return mlbScoreFunction();
  }
  return dailyScoreFunction();
}

/**
 * Default score function used to compare players. Basically just NBA at this point.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function dailyScoreFunction(): (player: IPlayer) => number {
  return (player: IPlayer) => {
    // The base score will be percent_started
    // percent_started has been broken before, so percent owned is a backup
    let score = player.percent_started ?? player.percent_owned;

    if (!player.is_playing || player.is_starting === 0) {
      score *= NOT_PLAYING_FACTOR;
    }
    if (!HEALTHY_STATUS_LIST.includes(player.injury_status)) {
      score *= INJURY_FACTOR;
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
export function nhlScoreFunction(): (player: IPlayer) => number {
  // TODO: need to add a test for this
  const starters = getNHLStartingGoalies() ?? [];
  return (player: IPlayer) => {
    // The base score will be percent_started
    // percent_started has been broken before, so percent owned is a backup
    let score = player.percent_started ?? player.percent_owned;

    const isPlayerInjured = !HEALTHY_STATUS_LIST.includes(player.injury_status);
    const isStartingGoalie = player.eligible_positions.includes("G")
      ? isStartingPlayer(player, starters)
      : false;
    if (!player.is_playing) {
      score *= NOT_PLAYING_FACTOR;
    }
    if (isPlayerInjured) {
      score *= INJURY_FACTOR;
    }
    if (isStartingGoalie) {
      score *= STARTING_FACTOR;
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
export function mlbScoreFunction(): (player: IPlayer) => number {
  const starters = getMLBStartingPitchers() ?? [];
  return (player: IPlayer) => {
    // The base score will be percent_started
    // percent_started has been broken before, so percent owned is a backup
    let score = player.percent_started ?? player.percent_owned;

    const isPlayerInjured = !HEALTHY_STATUS_LIST.includes(player.injury_status);
    const isStartingPitcher = player.eligible_positions.some((pos) =>
      ["P", "SP", "RP"].includes(pos)
    )
      ? isStartingPlayer(player, starters)
      : false;
    if (!player.is_playing) {
      score *= NOT_PLAYING_FACTOR;
    }
    if (isPlayerInjured) {
      score *= INJURY_FACTOR;
    }
    if (isStartingPitcher) {
      score *= STARTING_FACTOR;
    }
    return score;
  };
}

function isStartingPlayer(player: IPlayer, starters: string[]): boolean {
  if (starters.length === 0) {
    // default to is_starting flag if we can't get the starters array
    return player.is_starting === 1;
  }
  return starters.includes(player.player_key);
}

/**
 * Score function used to compare players in NFL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function nflScoreFunction(): (player: IPlayer) => number {
  return (player: IPlayer) => {
    // The score will be percent_started / rank_projected_week
    // TODO: Does rank_projected_week factor in injury status already?

    // The base score will be percent_started
    // percent_started has been broken before, so percent owned is a backup
    let score = player.percent_started ?? player.percent_owned;

    score = (score / player.ranks.projectedWeek) * 100;
    if (!player.is_playing) {
      score *= NOT_PLAYING_FACTOR;
    }
    if (!HEALTHY_STATUS_LIST.includes(player.injury_status)) {
      score *= INJURY_FACTOR;
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
export function weeklyLineupScoreFunction(): (player: IPlayer) => number {
  return (player: IPlayer) => {
    // The score will be the inverse of their projected rank for the next week
    // We will not factor in injury status as Yahoo has already accounted for it
    const score = 100 / player.ranks.next7Days;
    return score;
  };
}
