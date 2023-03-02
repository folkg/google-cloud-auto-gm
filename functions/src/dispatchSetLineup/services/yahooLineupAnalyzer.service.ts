import { Team } from "../interfaces/Team";
import { Player } from "../interfaces/Player";
import { addDropScoreFunction } from "./playerAddDropScoreFunctions.service";

/**
 * Get the strength of the roster for the given team
 *
 * @param {Team} roster
 * @return {[Record<string, number>, Record<string, number>]}
 */
export function getRosterStrength(
  roster: Team
): [Record<string, number>, Record<string, number>] {
  const { players, roster_positions: positionDelta } = roster;
  // const EXEMPT_POSITIONS = ["DEF", "K"]; // positions that don't count towards the roster strength

  const positionScores: Record<string, number> = {};
  players.forEach((player: Player) => {
    player.addDropScore = addDropScoreFunction(player);
    player.eligible_positions.forEach((position: string) => {
      if (positionScores[position]) {
        positionScores[position] += player.addDropScore;
      } else {
        positionScores[position] = player.addDropScore;
      }
      positionDelta[position]--;
    });
  });

  return [positionDelta, positionScores];
}
