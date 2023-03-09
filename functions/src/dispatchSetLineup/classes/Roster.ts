import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Player } from "../interfaces/Player";

export class Roster {
  private _allPlayers: Player[];
  private _editablePlayers: Player[];

  constructor(
    players: Player[],
    playerSitStartScoreFunction: (player: Player) => number
  ) {
    this._allPlayers = [...players];
    this._editablePlayers = this._allPlayers.filter(
      (player) => player.is_editable
    );
    this.editablePlayers.forEach((player) => {
      player.score = playerSitStartScoreFunction(player);
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });
  }

  /**
   * Sorts players in place by score, lowest to highest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   */
  static sortAscendingByScore(players: Player[]) {
    players.sort((a, b) => a.score - b.score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   */
  static sortDescendingByScore(players: Player[]) {
    players.sort((a, b) => b.score - a.score);
  }

  public get allPlayers(): Player[] {
    return this._allPlayers;
  }

  public get editablePlayers(): Player[] {
    return this._editablePlayers;
  }

  public get illegalPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) => !player.eligible_positions.includes(player.selected_position)
    );
  }

  public get legalPlayers(): Player[] {
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
}
