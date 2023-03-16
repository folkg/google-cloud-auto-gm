import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { IPlayer } from "../interfaces/IPlayer";
import { Player } from "./Player";

export class Roster {
  private _allPlayers: Player[];
  private _editablePlayers: Player[];
  private _rosterPositions: { [key: string]: number };

  constructor(
    players: IPlayer[],
    rosterPositions: { [key: string]: number },
    playerSitStartScoreFunction: (player: Player) => number
  ) {
    this._allPlayers = players.map((player) => new Player(player));

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
   * @param {Player[]} players - array of players to sort
   */
  static sortAscendingByScore(players: Player[]) {
    players.sort((a, b) => a.start_score - b.start_score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   */
  static sortDescendingByScore(players: Player[]) {
    players.sort((a, b) => b.start_score - a.start_score);
  }

  public get editablePlayers(): Player[] {
    return this._editablePlayers;
  }

  public get illegalPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) => !player.eligible_positions.includes(player.selected_position)
    );
  }

  public get startingPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.selected_position !== "BN"
    );
  }

  /**
   * players on the reserve list, which includes players on the inactive list
   * and players on the bench
   *
   * @public
   * @readonly
   * @type {Player[]}
   */
  public get reservePlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) =>
        INACTIVE_POSITION_LIST.includes(player.selected_position) ||
        player.selected_position === "BN"
    );
  }

  public get inactiveListPlayers(): Player[] {
    return this._editablePlayers.filter((player) =>
      INACTIVE_POSITION_LIST.includes(player.selected_position)
    );
  }

  public get inactiveOnRosterPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.eligible_positions.some((position) =>
          INACTIVE_POSITION_LIST.includes(position)
        )
    );
  }

  private get unfilledPositionCounter(): { [key: string]: number } {
    const result = { ...this._rosterPositions };
    this._allPlayers.forEach((player) => {
      result[player.selected_position]--;
    });
    return result;
  }

  public get unfilledAllPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) => this.unfilledPositionCounter[position] > 0
    );
  }

  public get unfilledActivePositions(): string[] {
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

  public get unfilledStartingPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        position !== "BN" &&
        !INACTIVE_POSITION_LIST.includes(position) &&
        this.unfilledPositionCounter[position] > 0
    );
  }

  public get overfilledPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) => this.unfilledPositionCounter[position] < 0
    );
  }

  public get numEmptyRosterSpots(): number {
    const unfilledPositions = this.unfilledPositionCounter;
    return Object.keys(unfilledPositions).reduce((acc, position) => {
      if (!INACTIVE_POSITION_LIST.includes(position))
        acc += unfilledPositions[position];
      return acc;
    }, 0);
  }
}
