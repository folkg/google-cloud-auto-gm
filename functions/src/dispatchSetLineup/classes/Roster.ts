import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Player } from "../interfaces/Player";
import { OptimizationPlayer } from "./OptimizationPlayer";

export class Roster {
  private _allPlayers: OptimizationPlayer[];
  private _editablePlayers: OptimizationPlayer[];
  private _unfilledPositionCounter: { [key: string]: number };

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
      player.score = playerSitStartScoreFunction(player);
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });

    const positionCounter = { ...rosterPositions };
    this._allPlayers.forEach((player) => {
      positionCounter[player.selected_position]--;
    });
    this._unfilledPositionCounter = positionCounter;
  }

  /**
   * Sorts players in place by score, lowest to highest
   *
   * @static
   * @param {OptimizationPlayer[]} players - array of players to sort
   */
  static sortAscendingByScore(players: OptimizationPlayer[]) {
    players.sort((a, b) => a.score - b.score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {OptimizationPlayer[]} players - array of players to sort
   */
  static sortDescendingByScore(players: OptimizationPlayer[]) {
    players.sort((a, b) => b.score - a.score);
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

  public get benchPlayers() {
    return this._editablePlayers.filter(
      (player) => player.selected_position === "BN"
    );
  }

  public get rosterPlayers() {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.selected_position !== "BN"
    );
  }

  public get activePlayers() {
    return this._editablePlayers.filter(
      (player) => !INACTIVE_POSITION_LIST.includes(player.selected_position)
    );
  }

  public get inactivePlayers() {
    return this._editablePlayers.filter((player) =>
      INACTIVE_POSITION_LIST.includes(player.selected_position)
    );
  }

  public get inactiveOnRosterPlayers() {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.eligible_positions.some((position) =>
          INACTIVE_POSITION_LIST.includes(position)
        )
    );
  }

  public get unfilledPositionCounter() {
    return this._unfilledPositionCounter;
  }
}
