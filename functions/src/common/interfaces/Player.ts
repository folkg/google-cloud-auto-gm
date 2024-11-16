import {
  array,
  boolean,
  Infer,
  number,
  object,
  optional,
  string,
  union,
  literal,
} from "superstruct";

export const PlayerOwnershipType = union([
  literal("waivers"),
  literal("freeagents"),
]);

export const PlayerOwnership = object({
  ownership_type: PlayerOwnershipType,
  waiver_date: optional(string()),
});

export const PlayerRanks = object({
  last30Days: number(),
  last14Days: number(),
  next7Days: number(),
  restOfSeason: number(),
  last4Weeks: number(),
  projectedWeek: number(),
  next4Weeks: number(),
});

export const Player = object({
  player_key: string(),
  player_name: string(),
  eligible_positions: array(string()),
  display_positions: array(string()),
  selected_position: string(),
  is_editable: boolean(),
  is_playing: boolean(),
  injury_status: string(),
  percent_started: number(),
  percent_owned: number(),
  percent_owned_delta: number(),
  is_starting: union([number(), string()]),
  is_undroppable: boolean(),
  ranks: PlayerRanks,
  ownership: optional(PlayerOwnership),
});

export type PlayerOwnership = Infer<typeof PlayerOwnership>;
export type PlayerRanks = Infer<typeof PlayerRanks>;
export type Player = Infer<typeof Player>;
