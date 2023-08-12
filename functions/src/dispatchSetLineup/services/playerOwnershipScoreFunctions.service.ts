import { Player } from "../classes/Player.js";

const scoreComponentLimit = {
  PERCENT_OWNED_DELTA_LIMIT: 3, // Applies to all sports
  RANK_LAST_30_DAYS_LIMIT: 6, // Applies to NHL, MLB, NBA only
  RANK_LAST_14_DAYS_LIMIT: 6,
  RANK_NEXT_7_DAYS_LIMIT: 4,
  RANK_REST_OF_SEASON_LIMIT: 4,
  RANK_LAST_4_WEEKS_LIMIT: 8, // Applies to NFL only
  RANK_PROJECTED_WEEK_LIMIT: 7,
  RANK_NEXT_4_WEEKS_LIMIT: 5,
};

/**
 * Returns a score function to determine the ownership score of individual players
 *
 * @export
 * @param {number} numPlayersInLeague - The number of players in the league
 * @return {()} - Returns a function that takes a palyer and returns a score between 0 and 120
 */
export function ownershipScoreFunctionFactory(
  numPlayersInLeague: number
): (player: Player) => number {
  return (player: Player) => {
    const percentOwnedDelta = player.percent_owned_delta
      ? Math.max(
          -scoreComponentLimit.PERCENT_OWNED_DELTA_LIMIT,
          Math.min(
            player.percent_owned_delta,
            scoreComponentLimit.PERCENT_OWNED_DELTA_LIMIT
          )
        )
      : 0;

    return (
      player.percent_owned +
      percentOwnedDelta +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.last30Days),
        scoreComponentLimit.RANK_LAST_30_DAYS_LIMIT
      ) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.last14Days),
        scoreComponentLimit.RANK_LAST_14_DAYS_LIMIT
      ) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.next7Days),
        scoreComponentLimit.RANK_NEXT_7_DAYS_LIMIT
      ) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.restOfSeason),
        scoreComponentLimit.RANK_REST_OF_SEASON_LIMIT
      ) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.last4Weeks),
        scoreComponentLimit.RANK_LAST_4_WEEKS_LIMIT
      ) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.projectedWeek),
        scoreComponentLimit.RANK_PROJECTED_WEEK_LIMIT
      ) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.next4Weeks),
        scoreComponentLimit.RANK_NEXT_4_WEEKS_LIMIT
      )
    );

    function resolveRank(rank: number): number {
      if (rank === -1) {
        return Infinity;
      } else {
        return rank;
      }
    }
  };
}
