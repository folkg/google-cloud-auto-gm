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
  // Num roster players * num teams = baseline

  // TODO: How to get the 25 FA players we will look at? What to sort by? percent_owned? rank_last14days? rank_season? transaction_delta?

  // const score =
  //   percent_owned +
  //   min(baseline / rank_last30days, 10) +
  //   min(baseline / rank_last14days, 5) +
  //   min(baseline / rank_next7days, 5) +
  //   min(baseline / rank_remaining_games, 10);

  //   min(baseline / rank_last_4_weeks, 10) +
  //   min(baseline / rank_projected_week, 10) +
  //   min(baseline / rank_next_4_weeks, 5) +

  const score = 0;

  return score;
}
