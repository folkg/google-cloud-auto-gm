import { IPlayer } from "../../common/interfaces/IPlayer.js";
import {
  HEALTHY_STATUS_LIST,
  INACTIVE_POSITION_LIST,
  LONG_TERM_IL_POSITIONS_LIST,
} from "../helpers/constants.js";

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
    const playerCopy = structuredClone(player);
    Object.assign(this, playerCopy);

    this.start_score = 0;
    this.ownership_score = 0;
    this.eligible_positions.push("BN"); // not included by default in Yahoo
  }

  compareStartScore(playerB: Player): number {
    return this.compareScores(this.start_score, playerB.start_score);
  }

  compareOwnershipScore(playerB: Player): number {
    return this.compareScores(this.ownership_score, playerB.ownership_score);
  }

  private compareScores(num1: number, num2: number) {
    const FLOAT_EQUALITY_TOLERANCE = 1e-12;
    const scoreDiff = num1 - num2;
    if (Math.abs(scoreDiff) < FLOAT_EQUALITY_TOLERANCE) {
      return 0;
    } else {
      return scoreDiff;
    }
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

  hasSameScoreAs(playerB: Player) {
    return this.compareStartScore(playerB) === 0;
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
      this.compareStartScore(playerB) > 0 && this.isEligibleToSwapWith(playerB)
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

  isEligibleForAnyPositionIn(positionsList: string[]): boolean {
    return positionsList.some((position) =>
      this.eligible_positions.includes(position)
    );
  }

  hasLowerStartScoreThanAll(playersList: Player[]): boolean {
    return playersList.every((player) => this.compareStartScore(player) <= 0);
  }

  hasLowerOwnershipScoreThanAll(playersList: Player[]): boolean {
    return playersList.every(
      (player) => this.compareOwnershipScore(player) <= 0
    );
  }

  makeInelliglbeForIL(): void {
    this.eligible_positions = this.eligible_positions.filter(
      (position) => !INACTIVE_POSITION_LIST.includes(position)
    );
  }
}
