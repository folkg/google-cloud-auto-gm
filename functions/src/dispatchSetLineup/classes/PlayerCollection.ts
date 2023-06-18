import { IPlayer } from "../../common/interfaces/IPlayer.js";
import { Player } from "./Player.js";

export class PlayerCollection {
  players: Player[];
  protected _ownershipScoreFunction: ((player: Player) => number) | undefined;

  constructor(iPlayers: IPlayer[]) {
    this.players = iPlayers.map((player) => new Player(player));
  }

  public get ownershipScoreFunction() {
    return this._ownershipScoreFunction;
  }

  public set ownershipScoreFunction(value) {
    this._ownershipScoreFunction = value;
  }

  public assignOwnershipScores() {
    if (this._ownershipScoreFunction) {
      this.players.forEach((player) => {
        player.ownership_score = this._ownershipScoreFunction!(player);
      });
    }
  }
}
