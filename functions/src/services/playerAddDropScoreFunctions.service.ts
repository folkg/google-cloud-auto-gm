import { Player } from "../interfaces/roster";

/**
 * Add drop score function
 *
 * @export
 * @param {Player} player - The player to score
 * @return {number} - The score
 */
export function addDropScoreFunction(player: Player): number {
  // score will be based on players transaction_delta, percent_owned, and rank_lat14days
  // transaction_delta and percent_owned should higher is better
  // rank_last14days lower is better
  const score = 0;

  return score;
}
