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
    return scoreFunctionNFL();
  } else if (weeklyDeadline && weeklyDeadline !== "intraday") {
    // weeklyDeadline will be something like "1" to represent Monday
    return scoreFunctionWeeklyLineup();
  } else if (gameCode === "nhl") {
    return scoreFunctionNHL();
  } else if (gameCode === "mlb") {
    return scoreFunctionMLB();
  }
  return scoreFunctionNBA();
}

/**
 * Default score function used to compare players. Basically just NBA at this point.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function scoreFunctionNBA(): (player: IPlayer) => number {
  return (player: IPlayer) => {
    const score = getInitialScore(player);
    return applyScoreFactors(score, player);
  };
}
/**
 * Score function used to compare players in NHL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function scoreFunctionNHL(): (player: IPlayer) => number {
  const startingGoalies = getNHLStartingGoalies() ?? [];
  return (player: IPlayer) => {
    const isStartingGoalie = player.eligible_positions.includes("G")
      ? isStartingPlayer(player, startingGoalies)
      : false;

    const score = getInitialScore(player);
    return applyScoreFactors(score, player, isStartingGoalie);
  };
}

/**
 * Score function used to compare players in NHL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function scoreFunctionMLB(): (player: IPlayer) => number {
  const startingPitchers = getMLBStartingPitchers() ?? [];
  return (player: IPlayer) => {
    const isStarting = player.eligible_positions.some((pos) =>
      ["P", "SP", "RP"].includes(pos)
    )
      ? isStartingPlayer(player, startingPitchers)
      : player.is_starting === 1;

    const score = getInitialScore(player);
    return applyScoreFactors(score, player, isStarting);
  };
}

/**
 * Score function used to compare players in NFL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
export function scoreFunctionNFL(): (player: IPlayer) => number {
  return (player: IPlayer) => {
    // TODO: Does rank_projected_week factor in injury status already? We might be double counting, but does it matter?
    const score = (getInitialScore(player) / player.ranks.projectedWeek) * 100;
    return applyScoreFactors(score, player);
  };
}
/**
 * Score function used to compare players in leagues that need their lineups
 * set weekly.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 */
export function scoreFunctionWeeklyLineup(): (player: IPlayer) => number {
  return (player: IPlayer) => {
    // The score will be the inverse of their projected rank for the next week
    // We will not factor in injury status as Yahoo has already accounted for it
    return 100 / player.ranks.next7Days;
  };
}

function getInitialScore(player: IPlayer): number {
  // The base score will be percent_started
  // percent_started has been broken before, so percent owned is a backup
  // Also make sure we return at least 1 to prevent issues with subsequent factors
  return (player.percent_started ?? player.percent_owned) || 1;
}

function applyScoreFactors(
  score: number,
  player: IPlayer,
  isStartingPlayer = false
) {
  const isPlayerInjured = !HEALTHY_STATUS_LIST.includes(player.injury_status);
  if (isPlayerInjured) {
    score *= INJURY_FACTOR;
  }
  if (!player.is_playing || player.is_starting === 0) {
    score *= NOT_PLAYING_FACTOR;
  }
  if (isStartingPlayer) {
    score *= STARTING_FACTOR;
  }
  return score;
}

function isStartingPlayer(player: IPlayer, starters: string[]): boolean {
  if (starters.length === 0) {
    // default to is_starting flag if we can't get the starters array
    return player.is_starting === 1;
  }
  return starters.includes(player.player_key);
}
