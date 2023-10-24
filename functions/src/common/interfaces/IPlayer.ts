export interface IPlayer {
  player_key: string;
  player_name: string;
  eligible_positions: string[];
  display_positions: string[];
  selected_position: string;
  is_editable: boolean;
  is_playing: boolean;
  injury_status: string;
  percent_started: number;
  percent_owned: number | undefined;
  percent_owned_delta: number | undefined;
  is_starting: number | string;
  is_undroppable: boolean;
  ranks: PlayerRanks;
  ownership?: PlayerOwnership;
}

export type PlayerRanks = {
  last30Days: number;
  last14Days: number;
  next7Days: number;
  restOfSeason: number;
  last4Weeks: number;
  projectedWeek: number;
  next4Weeks: number;
};

export type PlayerOwnership = {
  ownership_type: PlayerOwnershipType;
  waiver_date?: string; // "2023-06-21"
};

type PlayerOwnershipType = "waivers" | "freeagents";
