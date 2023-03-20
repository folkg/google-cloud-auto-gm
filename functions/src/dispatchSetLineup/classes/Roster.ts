import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { IPlayer } from "../interfaces/IPlayer";
import { ownershipScoreFunction } from "../services/playerOwnershipScoreFunctions.service";
import { playerStartScoreFunctionFactory } from "../services/playerStartScoreFunctions.service";
import { Player } from "./Player";

export class Roster {
  private _allPlayers: Player[];
  private _editablePlayers: Player[];
  private _rosterPositions: { [key: string]: number };

  constructor(
    players: IPlayer[],
    rosterPositions: { [key: string]: number },
    numTeamsInLeague: number,
    gameCode: string,
    weeklyDeadline: string
  ) {
    this._allPlayers = players.map((player) => new Player(player));

    this._editablePlayers = this._allPlayers.filter(
      (player) => player.is_editable
    );
    this._rosterPositions = { ...rosterPositions };

    const playerStartScoreFunction = playerStartScoreFunctionFactory(
      gameCode,
      weeklyDeadline
    );

    this._allPlayers.forEach((player) => {
      player.start_score = playerStartScoreFunction(player);
      player.ownership_score = ownershipScoreFunction(
        player,
        numTeamsInLeague * this.numStandardRosterSpots
      );
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });
    // console.log(
    //   this._allPlayers
    //     .sort((a, b) => b.ownership_score - a.ownership_score)
    //     .map(
    //       (player) =>
    //         player.player_name +
    //         " " +
    //         player.ownership_score +
    //         " " +
    //         player.percent_owned
    //     )
    // );
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

  public get numStandardRosterSpots(): number {
    return Object.keys(this._rosterPositions).reduce((acc, position) => {
      if (!INACTIVE_POSITION_LIST.includes(position))
        acc += this._rosterPositions[position];
      return acc;
    }, 0);
  }

  public get criticalPositions(): string[] {
    return Object.keys(this._rosterPositions).filter((position) => {
      const numPlayersAtPosition = this._allPlayers.filter((player) =>
        player.eligible_positions.includes(position)
      ).length;
      return numPlayersAtPosition < this._rosterPositions[position];
    });
  }

  public get positionalScores() {
    return Object.keys(this._rosterPositions).map((position) => {
      const positionScore = this._allPlayers.reduce((acc, player) => {
        if (player.eligible_positions.includes(position))
          acc += player.ownership_score;
        return acc;
      }, 0);
      return { position: positionScore };
    });
  }
}
