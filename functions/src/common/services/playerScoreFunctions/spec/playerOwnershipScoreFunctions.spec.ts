import { it, describe, expect, beforeEach } from "vitest";
import { LeagueSpecificScarcityOffsets } from "../../../../calcPositionalScarcity/services/positionalScarcity.service";
import { ownershipScoreFunctionFactory } from "../../../../common/services/playerScoreFunctions/playerOwnershipScoreFunctions.service";
import { Player } from "../../../classes/Player";
describe("positionalScarcityOffsets", () => {
  let positionalScarcityOffsets: LeagueSpecificScarcityOffsets;
  let player: Player;

  const numPlayersInLeage = 200;
  const resultNoScarcity = 81;

  beforeEach(() => {
    player = {
      percent_owned: 75,
      percent_owned_delta: 0,
      ranks: {
        last30Days: -1,
        last14Days: -1,
        next7Days: -1,
        restOfSeason: -1,
        last4Weeks: 100,
        projectedWeek: 100,
        next4Weeks: 100,
      },
      eligible_positions: ["BN"],
    } as unknown as Player;

    positionalScarcityOffsets = {
      QB: 90,
      RB: 50,
      WR: 40,
      TE: 90,
    };
  });

  it("should not apply a positional scarcity offset if the player is not eligible at any position", () => {
    const resultA = ownershipScoreFunctionFactory(
      numPlayersInLeage,
      positionalScarcityOffsets
    )(player);
    expect(resultA).toEqual(resultNoScarcity);
  });

  it("should apply the positional scarcity offset if the player is eligible at one position", () => {
    player.eligible_positions = ["RB", "BN"];
    const resultA = ownershipScoreFunctionFactory(
      numPlayersInLeage,
      positionalScarcityOffsets
    )(player);
    expect(resultA).toEqual(resultNoScarcity - 50);
  });

  it("should apply the lowest positional scarcity offset if the player is eligible at multiple positions", () => {
    player.eligible_positions = ["RB", "WR", "RB/WR/TE", "BN"];
    const resultA = ownershipScoreFunctionFactory(
      numPlayersInLeage,
      positionalScarcityOffsets
    )(player);
    expect(resultA).toEqual(resultNoScarcity - 40);
  });

  it("should NOT apply the positional scarcity offset if the player is eligible at one position and the offset is negative", () => {
    positionalScarcityOffsets["test-negative"] = -100;
    player.eligible_positions = ["QB", "BN", "test-negative"];
    const resultA = ownershipScoreFunctionFactory(
      numPlayersInLeage,
      positionalScarcityOffsets
    )(player);
    expect(resultA).toEqual(resultNoScarcity);
  });
  it("should NOT apply the positional scarcity offset if positionalScarcityOffsets is {}", () => {
    const resultA = ownershipScoreFunctionFactory(
      numPlayersInLeage,
      {}
    )(player);
    expect(resultA).toEqual(resultNoScarcity);
  });
  it("should NOT apply the positional scarcity offset if positionalScarcityOffsets is undefined", () => {
    const resultA = ownershipScoreFunctionFactory(
      numPlayersInLeage,
      undefined
    )(player);
    expect(resultA).toEqual(resultNoScarcity);
  });
});
