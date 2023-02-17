import { Roster } from "../interfaces/roster";
import { addDropScoreFunction } from "./playerAddDropScoreFunctions.service";

/**
 * Get the strength of the roster for the given team
 *
 * @param {Roster} roster
 * @return {[Record<string, number>, Record<string, number>]}
 */
export function getRosterStrength(
  roster: Roster
): [Record<string, number>, Record<string, number>] {
  const { players, roster_positions: positionDelta } = roster;
  // const EXEMPT_POSITIONS = ["DEF", "K"]; // positions that don't count towards the roster strength

  const positionScores: Record<string, number> = {};
  players.forEach((player) => {
    player.addDropScore = addDropScoreFunction(player);
    player.eligible_positions.forEach((position) => {
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
