import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Player } from "../interfaces/Player";

export interface OptimizationPlayer extends Player {
  start_score: number;
  ownership_score: number;
}

/**
 * A class that extends the Player interface to add useful methods for
 * lineup Optimization.
 *
 * @export
 * @class OptimizationPlayer
 * @typedef {OptimizationPlayer}
 * @implements {Player}
 */
export class OptimizationPlayer implements OptimizationPlayer {
  constructor(player: Player) {
    Object.assign(this, player);
  }

  isActiveRoster(): boolean {
    return !INACTIVE_POSITION_LIST.includes(this.selected_position);
  }

  isInactiveList(): boolean {
    return INACTIVE_POSITION_LIST.includes(this.selected_position);
  }

  isIllegalPosition(): boolean {
    return !this.eligible_positions.includes(this.selected_position);
  }

  isEligibleToSwapWith(playerB: OptimizationPlayer): boolean {
    return (
      playerB.player_key !== this.player_key &&
      playerB.selected_position !== this.selected_position &&
      playerB.eligible_positions.includes(this.selected_position) &&
      this.eligible_positions.includes(playerB.selected_position)
    );
  }

  getEligiblePositionsIn(positionsList: string[]): string[] {
    return this.eligible_positions.filter(
      (position) =>
        position !== this.selected_position && positionsList.includes(position)
    );
  }

  /**
   * Returns a list of players that are eligible to swap with this player
   * and have a lower start score than this player.
   *
   * @param {OptimizationPlayer[]} playersList
   * @return {OptimizationPlayer[]}
   */
  getDesirableTargets(playersList: OptimizationPlayer[]): OptimizationPlayer[] {
    return playersList.filter(
      (player) =>
        this.eligible_positions.includes(player.selected_position) &&
        this.start_score > player.start_score
    );
  }

  hasLowerScoreThanAllPlayersIn(playersList: OptimizationPlayer[]): boolean {
    return playersList.every(
      (player) => player.start_score >= this.start_score
    );
  }
}
