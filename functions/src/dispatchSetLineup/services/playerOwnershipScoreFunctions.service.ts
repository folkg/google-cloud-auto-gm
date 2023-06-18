import { Player } from "../classes/Player.js";

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
    // A player can add up to 20 points to their ownership score.
    // Historical performance is weighted more heavily than the yahoo projections
    return (
      player.percent_owned +
      Math.min(numPlayersInLeague / resolveRank(player.ranks.last30Days), 6) +
      Math.min(numPlayersInLeague / resolveRank(player.ranks.last14Days), 6) +
      Math.min(numPlayersInLeague / resolveRank(player.ranks.next7Days), 4) +
      Math.min(numPlayersInLeague / resolveRank(player.ranks.restOfSeason), 4) +
      Math.min(numPlayersInLeague / resolveRank(player.ranks.last4Weeks), 8) +
      Math.min(
        numPlayersInLeague / resolveRank(player.ranks.projectedWeek),
        7
      ) +
      Math.min(numPlayersInLeague / resolveRank(player.ranks.next4Weeks), 5)
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
