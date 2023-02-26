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
  // const { transaction_delta, percent_owned, rank_last30days ,rank_last14days, rank_last7days, rank_next7days, rank_projected_week , rank_projected_season} = player;

  // const score =
  //   percent_owned +
  //   max(min(adds / drops, 10), -10) +
  //   min(100 / rank_last30days, 5) +
  //   min(100 / rank_last14days, 5) +
  //   min(100 / rank_last7days, 5) +
  //   min(100 / rank_next7days, 5) +
  //   min(100 / rank_projected_week, 5) +
  //   min(100 / rank_projected_season, 5);

  const score = 0;

  return score;
}
