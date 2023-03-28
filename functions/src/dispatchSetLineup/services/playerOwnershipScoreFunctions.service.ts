import { IPlayer } from "../interfaces/IPlayer";

/**
 * Add drop score function
 *
 * @export
 * @param {OptimizationPlayer} player - The player to score
 * @param {number} numPlayersInLeague - The number of players in the league
 * @return {number} - The score
 */
export function ownershipScoreFunction(
  player: IPlayer,
  numPlayersInLeague: number
): number {
  // if (player.player_name === "Kris Letang") {
  //   logger.log(player.player_name);
  //   logger.log(player.percent_owned);
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.last30Days), 6)
  //   );
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.last14Days), 6)
  //   );
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.next7Days), 4)
  //   );
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.restOfSeason), 4)
  //   );
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.last4Weeks), 8)
  //   );
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.projectedWeek), 7)
  //   );
  //   logger.log(
  //     Math.min(numPlayersInLeague / resolveRank(player.ranks.next4Weeks), 5)
  //   );
  // }

  // A player can add up to 20 points to their ownership score.
  // Historical performance is weighted more heavily than the yahoo projections
  return (
    player.percent_owned +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.last30Days), 6) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.last14Days), 6) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.next7Days), 4) +
    Math.min(numPlayersInLeague / resolveRank(player.ranks.restOfSeason), 4) +
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
