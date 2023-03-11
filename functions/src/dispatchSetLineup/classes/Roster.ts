import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Player } from "../interfaces/Player";
import { OptimizationPlayer } from "./OptimizationPlayer";

export class Roster {
  private _allPlayers: OptimizationPlayer[];
  private _editablePlayers: OptimizationPlayer[];
  private _rosterPositions: { [key: string]: number };

  constructor(
    players: Player[],
    rosterPositions: { [key: string]: number },
    playerSitStartScoreFunction: (player: OptimizationPlayer) => number
  ) {
    this._allPlayers = players.map((player) => new OptimizationPlayer(player));

    this._editablePlayers = this._allPlayers.filter(
      (player) => player.is_editable
    );
    this.editablePlayers.forEach((player) => {
      player.start_score = playerSitStartScoreFunction(player);
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });

    this._rosterPositions = { ...rosterPositions };
  }

  /**
   * Sorts players in place by score, lowest to highest
   *
   * @static
   * @param {OptimizationPlayer[]} players - array of players to sort
   */
  static sortAscendingByScore(players: OptimizationPlayer[]) {
    players.sort((a, b) => a.start_score - b.start_score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {OptimizationPlayer[]} players - array of players to sort
   */
  static sortDescendingByScore(players: OptimizationPlayer[]) {
    players.sort((a, b) => b.start_score - a.start_score);
  }

  public get allPlayers(): OptimizationPlayer[] {
    return this._allPlayers;
  }

  public get editablePlayers(): OptimizationPlayer[] {
    return this._editablePlayers;
  }

  public get illegalPlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter(
      (player) => !player.eligible_positions.includes(player.selected_position)
    );
  }

  public get legalPlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter((player) =>
      player.eligible_positions.includes(player.selected_position)
    );
  }

  public get activePlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter(
      (player) => !INACTIVE_POSITION_LIST.includes(player.selected_position)
    );
  }

  public get benchPlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter(
      (player) => player.selected_position === "BN"
    );
  }

  public get activeRosterPlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.selected_position !== "BN"
    );
  }

  public get inactivePlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter((player) =>
      INACTIVE_POSITION_LIST.includes(player.selected_position)
    );
  }

  public get inactiveOnRosterPlayers(): OptimizationPlayer[] {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.eligible_positions.some((position) =>
          INACTIVE_POSITION_LIST.includes(position)
        )
    );
  }

  public get unfilledPositionCounter(): { [key: string]: number } {
    const result = { ...this._rosterPositions };
    this._allPlayers.forEach((player) => {
      result[player.selected_position]--;
    });
    return result;
  }

  public get unfilledRosterPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        !INACTIVE_POSITION_LIST.includes(position) &&
        this.unfilledPositionCounter[position] > 0
    );
  }

  public get unfilledInactivePositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        INACTIVE_POSITION_LIST.includes(position) &&
        this.unfilledPositionCounter[position] > 0
    );
  }
}
