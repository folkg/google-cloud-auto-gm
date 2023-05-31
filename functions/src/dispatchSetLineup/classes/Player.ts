import {
  HEALTHY_STATUS_LIST,
  INACTIVE_POSITION_LIST,
  LONG_TERM_IL_POSITIONS_LIST,
} from "../helpers/constants";
import { IPlayer } from "../interfaces/IPlayer";

export interface Player extends IPlayer {
  start_score: number;
  ownership_score: number;
}

/**
 * A class that extends the Player interface to add useful methods for
 * lineup Optimization.
 *
 * @export
 * @class OptimizationPlayer
 * @typedef {Player}
 * @implements {IPlayer}
 */
export class Player implements Player {
  constructor(player: IPlayer) {
    // no need to clone anymore, since the only caller already cloned the original
    // const playerCopy = structuredClone(player);
    Object.assign(this, player);
  }

  compareStartScore(playerB: Player): number {
    return this.start_score - playerB.start_score;
  }

  isInactiveList(): boolean {
    return INACTIVE_POSITION_LIST.includes(this.selected_position);
  }

  isInactiveListEligible(): boolean {
    return this.eligible_positions.some((position) =>
      INACTIVE_POSITION_LIST.includes(position)
    );
  }

  isLTIR(): boolean {
    return this.eligible_positions.some((position) =>
      LONG_TERM_IL_POSITIONS_LIST.includes(position)
    );
  }

  isActiveRoster(): boolean {
    return !INACTIVE_POSITION_LIST.includes(this.selected_position);
  }

  isStartingRosterPlayer(): boolean {
    return (
      this.selected_position !== "BN" &&
      !INACTIVE_POSITION_LIST.includes(this.selected_position)
    );
  }

  isReservePlayer(): boolean {
    return !this.isStartingRosterPlayer();
  }

  isIllegalPosition(): boolean {
    return !this.eligible_positions.includes(this.selected_position);
  }

  isHealthy(): boolean {
    return HEALTHY_STATUS_LIST.includes(this.injury_status);
  }

  isEligibleToSwapWith(playerB: Player): boolean {
    return (
      playerB !== this &&
      playerB.selected_position !== this.selected_position &&
      this.eligible_positions.includes(playerB.selected_position) &&
      playerB.eligible_positions.includes(this.selected_position)
    );
  }

  isEligibleAndHigherScoreThan(playerB: Player): boolean {
    return (
      this.start_score > playerB.start_score &&
      this.isEligibleToSwapWith(playerB)
    );
  }

  getEligibleTargetPlayers(playersList: Player[]): Player[] {
    return playersList.filter(
      (targetPlayer) =>
        targetPlayer !== this &&
        targetPlayer.selected_position !== this.selected_position &&
        this.eligible_positions.includes(targetPlayer.selected_position)
    );
  }

  findEligiblePositionIn(positionsList: string[]): string | undefined {
    return this.eligible_positions.find(
      (position) =>
        position !== this.selected_position && positionsList.includes(position)
    );
  }

  hasLowerStartScoreThanAll(playersList: Player[]): boolean {
    return playersList.every(
      (player) => player.start_score >= this.start_score
    );
  }

  hasLowerOwnershipScoreThanAll(playersList: Player[]): boolean {
    return playersList.every(
      (player) => player.ownership_score >= this.ownership_score
    );
  }

  makeInelliglbeForIL(): void {
    this.eligible_positions = this.eligible_positions.filter(
      (position) => !INACTIVE_POSITION_LIST.includes(position)
    );
  }
}
