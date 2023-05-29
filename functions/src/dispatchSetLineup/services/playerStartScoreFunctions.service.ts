import { IPlayer } from "../../common/interfaces/IPlayer";
import { GamesPlayed, InningsPitched } from "../../common/interfaces/ITeam";
import {
  getMLBStartingPitchers,
  getNHLStartingGoalies,
} from "../../common/services/yahooAPI/yahooStartingPlayer.service";
import {
  HEALTHY_STATUS_LIST,
  INACTIVE_POSITION_LIST,
  LONG_TERM_IL_POSITIONS_LIST,
} from "../helpers/constants";
import { ownershipScoreFunction } from "./playerOwnershipScoreFunctions.service";

const NOT_PLAYING_FACTOR = 1e-7; // 0.0000001
const INJURY_FACTOR = 1e-3; // 0.001
const LTIR_FACTOR = 1e-1; // 0.1 // extra penalty on top of INJURY_FACTOR
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

export function scoreFunctionMaxGamesPlayed(
  gamesPlayed: GamesPlayed[],
  churnFunction: (player: IPlayer) => number,
  inningsPitched?: InningsPitched
): (player: IPlayer) => number {
  const CONSERVATIVE_FACTOR = 1000;
  const CHURN_THRESHOLD = 0.9;
  return (player: IPlayer) => {
    const paceKeeper = getPaceKeeper(player);
    if (paceKeeper === undefined) return 0;
    if (paceKeeper.projected < paceKeeper.max * CHURN_THRESHOLD) {
      return churnFunction(player);
    }

    // TODO: This whole function seems messy. Need to get it on paper first, then clean up.
    const NUM_PLAYERS_IN_LEAGUE = 100; // should get the actual number from the caller
    let score =
      CONSERVATIVE_FACTOR *
      ownershipScoreFunction(player, NUM_PLAYERS_IN_LEAGUE);
    score = applyInjuryScoreFactors(score, player);
    // score boost will make it harder to replace players currently in lineup
    return score + getScoreBoost(player, paceKeeper);
  };

  function getPaceKeeper(player: IPlayer) {
    const isPitcher =
      inningsPitched &&
      player.eligible_positions.some((pos) => ["P", "SP", "RP"].includes(pos));
    if (isPitcher) {
      return inningsPitched;
    }
    const gp = gamesPlayed.find((gp) =>
      player.eligible_positions.includes(gp.position)
    );
    return gp?.games_played;
  }

  function getScoreBoost(player: IPlayer, paceKeeper: any) {
    // We could be passing player class objects here instead of IPlayer and then call that helper function we have there
    const isActiveLineup =
      player.selected_position !== "BN" &&
      !INACTIVE_POSITION_LIST.includes(player.selected_position);
    if (!isActiveLineup) return 0;

    const currentPace = paceKeeper.projected / paceKeeper.max;
    return (
      ((currentPace - CHURN_THRESHOLD) / (1 - CHURN_THRESHOLD)) *
      CONSERVATIVE_FACTOR *
      10
    );
  }
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
  const NOT_STARTING_FACTOR = 1e-2; // 0.01
  const startingPitchers = getMLBStartingPitchers() ?? [];
  return (player: IPlayer) => {
    // TODO: Do we need to boost the score for starting pitchers? Or is it superfluous?
    // Boost the score for starting pitchers since they only get starting_status === 1.
    // Penalize the non-starting SP pitchers so they don't start over an RP that is playing.

    // Penalize non-starting batters if their starting_score === 0 instead, however,
    // since there are often late confirmations and we don't want to leave a good
    // unconfirmed player on the bench in favour of a bad confirmed starter.
    const isPitcher = player.eligible_positions.some((pos) =>
      ["P", "SP", "RP"].includes(pos)
    );
    let isStartingPitcher = false;
    if (isPitcher) {
      isStartingPitcher = isStartingPlayer(player, startingPitchers);
    }
    const isNonStartingSP =
      player.eligible_positions.includes("SP") &&
      !player.eligible_positions.includes("RP") &&
      !isStartingPitcher;

    let score = getInitialScore(player);
    if (player.is_starting === 0 || isNonStartingSP || isLTIR(player)) {
      score *= NOT_STARTING_FACTOR;
    }
    return applyScoreFactors(score, player, isStartingPitcher);
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
): number {
  let result = applyInjuryScoreFactors(score, player);
  if (!player.is_playing) {
    result *= NOT_PLAYING_FACTOR;
  }
  if (isStartingPlayer) {
    result *= STARTING_FACTOR;
  }
  return result;
}

function applyInjuryScoreFactors(score: number, player: IPlayer): number {
  const isPlayerInjured = !HEALTHY_STATUS_LIST.includes(player.injury_status);
  if (isPlayerInjured) {
    score *= INJURY_FACTOR;
    if (isLTIR(player)) {
      score *= LTIR_FACTOR;
    }
  }
  return score;
}

function isStartingPlayer(player: IPlayer, starters: string[]): boolean {
  // starters array is not always accurate, so we need to check both
  return starters.includes(player.player_key) || player.is_starting === 1;
}

// TODO: If we us
function isLTIR(player: IPlayer): boolean {
  return player.eligible_positions.some((pos) =>
    LONG_TERM_IL_POSITIONS_LIST.includes(pos)
  );
}
