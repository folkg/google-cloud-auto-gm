import {
  any,
  array,
  boolean,
  Infer,
  number,
  object,
  optional,
  record,
  string,
  union,
  literal,
} from "superstruct";
import { Player } from "./Player.js";

export const Leagues = union([
  literal("mlb"),
  literal("nba"),
  literal("nfl"),
  literal("nhl"),
]);

const CommonTeam = object({
  team_key: string(),
  game_code: string(), // TODO: Change to Leagues
  start_date: number(),
  end_date: number(),
  weekly_deadline: string(), // TODO: Is this string() | number()?
  roster_positions: record(string(), number()),
  num_teams: number(),
});

const OptionsTeam = object({
  allow_transactions: boolean(),
  allow_dropping: boolean(),
  allow_adding: boolean(),
  allow_add_drops: boolean(),
  allow_waiver_adds: boolean(),
  automated_transaction_processing: optional(boolean()),
  last_updated: number(),
  lineup_paused_at: optional(number()),
});

export const FirestoreTeam = object({
  ...CommonTeam.schema,
  ...OptionsTeam.schema,
  uid: string(),
  is_subscribed: boolean(),
  is_setting_lineups: boolean(),
});

export const YahooTeam = object({
  ...CommonTeam.schema,
  edit_key: string(),
  faab_balance: number(),
  current_weekly_adds: number(),
  current_season_adds: number(),
  scoring_type: string(),
  team_name: string(),
  league_name: string(),
  max_weekly_adds: number(),
  max_season_adds: number(),
  waiver_rule: string(),
});

export const GamesPlayed = object({
  position: string(),
  games_played: object({
    played: number(),
    max: number(),
    projected: number(),
  }),
});

export const InningsPitched = object({
  pitched: number(),
  max: number(),
  projected: number(),
});

// TODO: Better naming / functions for AngularTeam / ClientTeam.
// Angular Teams never actually make it to Angular, it is the client team. This is some sort of DTO.
export const AngularTeam = object({
  ...YahooTeam.schema,
  uid: optional(string()),
  max_games_played: number(),
  max_innings_pitched: number(),
  game_name: string(),
  game_season: string(),
  game_is_over: boolean(), // TODO: Is this boolean() | string()?
  team_url: string(),
  team_logo: string(),
  rank: union([string(), number()]),
  // TODO: I think the below are all nullable?
  points_for: union([string(), number()]),
  points_against: union([string(), number()]),
  points_back: union([string(), number()]),
  outcome_totals: object({
    wins: union([string(), number()]),
    losses: union([string(), number()]),
    ties: union([string(), number()]),
    percentage: union([string(), number()]),
  }),
});

export const ClientTeam = object({
  ...AngularTeam.schema,
  ...FirestoreTeam.schema,
});

export const OptimizerTeam = object({
  ...YahooTeam.schema,
  ...optional(OptionsTeam).schema,
  players: array(Player),
  coverage_type: string(),
  coverage_period: string(),
  transactions: array(any()),
  games_played: optional(array(GamesPlayed)),
  innings_pitched: optional(InningsPitched),
});

export type CommonTeam = Infer<typeof CommonTeam>;
export type FirestoreTeam = Infer<typeof FirestoreTeam>;
export type YahooTeam = Infer<typeof YahooTeam>;
export type AngularTeam = Infer<typeof AngularTeam>;
export type ClientTeam = Infer<typeof ClientTeam>;
export type OptimizerTeam = Infer<typeof OptimizerTeam>;

export type GamesPlayed = Infer<typeof GamesPlayed>;
export type InningsPitched = Infer<typeof InningsPitched>;
