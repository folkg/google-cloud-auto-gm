import { Player } from "../interfaces/Player";

export interface OptimizationPlayer extends Player {}

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

  isEligibleToSwapWith(playerB: OptimizationPlayer): boolean {
    return (
      playerB.player_key !== this.player_key &&
      playerB.eligible_positions.includes(this.selected_position) &&
      this.eligible_positions.includes(playerB.selected_position)
    );
  }
}
