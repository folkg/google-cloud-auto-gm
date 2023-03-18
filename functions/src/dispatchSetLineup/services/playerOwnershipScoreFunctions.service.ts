import { IPlayer } from "../interfaces/IPlayer";

/**
 * Add drop score function
 *
 * @export
 * @param {OptimizationPlayer} player - The player to score
 * @return {number} - The score
 */
export function ownershipScoreFunction(
  player: IPlayer,
  numPlayersInLeague: number
): number {
  // console.log(player.player_name);
  // console.log(player.percent_owned);
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.last30Days), 5)
  // );
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.last14Days), 5)
  // );
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.next7Days), 5)
  // );
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.restOfSeason), 5)
  // );
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.last4Weeks), 5)
  // );
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.projectedWeek), 5)
  // );
  // console.log(
  //   Math.min(numPlayersInLeague / resolveRank(player.ranks.next4Weeks), 5)
  // );

  // A player can add up to 20 points to their ownership score.
  // Historical performance is weighted more heavily than the yahoo projections
  return (
    player.percent_owned +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.last30Days), 7) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.last14Days), 8) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.next7Days), 5) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.restOfSeason), 5) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.last4Weeks), 8) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.projectedWeek), 7) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.next4Weeks), 5)
  );

  function resolveRank(rank: number): number {
    if (rank === -1) {
      return Infinity;
    } else {
      return rank;
    }
  }
}
