import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Player } from "../interfaces/Player";

export class Players {
  private _allPlayers: Player[];
  public get allPlayers(): Player[] {
    return this._allPlayers;
  }

  private _editablePlayers: Player[];
  public get editablePlayers(): Player[] {
    return this._editablePlayers;
  }

  constructor(
    players: Player[],
    playerSitStartScoreFunction: (player: Player) => number
  ) {
    this._allPlayers = players;
    this._editablePlayers = players.filter((player) => player.is_editable);
    this.editablePlayers.forEach((player) => {
      player.score = playerSitStartScoreFunction(player);
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });
  }

  static sortAscendingByScore(players: Player[]) {
    players.sort((a, b) => a.score - b.score);
  }

  static sortDescendingByScore(players: Player[]) {
    players.sort((a, b) => b.score - a.score);
  }

  public get illegalPlayers(): Player[] {
    return this.editablePlayers.filter(
      (player) => !player.eligible_positions.includes(player.selected_position)
    );
  }

  public get legalPlayers(): Player[] {
    return this.editablePlayers.filter((player) =>
      player.eligible_positions.includes(player.selected_position)
    );
  }

  public get benchPlayers() {
    return this.editablePlayers.filter(
      (player) => player.selected_position === "BN"
    );
  }

  public get rosterPlayers() {
    return this.editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.selected_position !== "BN"
    );
  }

  public get benchPlayersWithGameToday() {
    return this.editablePlayers.filter(
      (player) => player.selected_position === "BN" && player.is_playing
    );
  }
}
