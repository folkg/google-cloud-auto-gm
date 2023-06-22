import assert from "assert";
import { IPlayer } from "../../common/interfaces/IPlayer.js";
import { Player } from "./Player.js";

export class PlayerCollection {
  players: Player[];
  protected _ownershipScoreFunction: ((player: Player) => number) | undefined;

  constructor(iPlayers: IPlayer[]) {
    this.players = iPlayers.map((player) => new Player(player));
  }

  /**
   * Sorts players in place by score, lowest to highest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   * @return {Player[]} - sorted array of players
   */
  static sortAscendingByStartScore(players: Player[]): Player[] {
    return players.sort((a, b) => a.start_score - b.start_score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   * @return {Player[]} - sorted array of players
   */
  static sortDescendingByStartScore(players: Player[]): Player[] {
    return players.sort((a, b) => b.start_score - a.start_score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   * @return {Player[]} - sorted array of players
   */
  static sortDescendingByOwnershipScore(players: Player[]): Player[] {
    return players.sort((a, b) => b.ownership_score - a.ownership_score);
  }

  // alias for players
  public get allPlayers(): Player[] {
    return this.players;
  }

  public get ownershipScoreFunction() {
    return this._ownershipScoreFunction;
  }

  public set ownershipScoreFunction(value) {
    this._ownershipScoreFunction = value;
    this.assignOwnershipScores();
  }

  protected assignOwnershipScores() {
    assert(
      this._ownershipScoreFunction,
      "ownershipScoreFunction should always be defined before calling assignOwnershipScores"
    );

    const ownershipScoreFunction = this._ownershipScoreFunction;

    this.players.forEach((player) => {
      player.ownership_score = ownershipScoreFunction(player);
    });
  }

  public sortDescByOwnershipScoreAndRemoveDuplicates() {
    this.players.sort(
      (a: Player, b: Player) => b.ownership_score - a.ownership_score
    );
    this.players = this.players.filter(
      (player, i, all) => player.player_key !== all[i - 1]?.player_key
    );
  }

  public removePlayer(playerToRemove: Player) {
    this.players = this.players.filter(
      (player) => player.player_key !== playerToRemove.player_key
    );
  }
}
