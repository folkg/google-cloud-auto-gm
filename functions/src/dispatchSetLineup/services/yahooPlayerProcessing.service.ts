import { IPlayer, PlayerRanks } from "../../common/interfaces/IPlayer.js";
import {
  getChild,
  parseStringToInt,
} from "../../common/services/utilities.service.js";

/**
 * Deconstruct the players JSON object to get the required properties
 *
 * @param {*} playersJSON - The players JSON object
 * @param {*} emptyPositions - A map of positions and the number of players
 * @return {IPlayer[]} - An array of Player objects
 */
export default function getPlayersFromRoster(playersJSON: any): IPlayer[] {
  const result: IPlayer[] = [];

  // eslint-disable-next-line guard-for-in
  for (const key in playersJSON) {
    if (key !== "count") {
      const player = playersJSON[key].player;
      const opponent = getChild(player, "opponent");
      const selectedPosition = getChild(player, "selected_position");

      const playerObject: IPlayer = {
        player_key: getChild(player[0], "player_key"),
        player_name: getChild(player[0], "name").full,
        eligible_positions: getEligiblePositions(player),
        selected_position:
          selectedPosition && getChild(selectedPosition, "position"),
        is_editable: getChild(player, "is_editable") === 1,
        is_playing: !(!opponent || opponent === "Bye"),
        injury_status: getChild(player[0], "status_full") || "Healthy",
        percent_started: getPercentObject(player, "percent_started"),
        percent_owned: getPercentObject(player, "percent_owned"),
        percent_owned_delta: parseStringToInt(
          getChild(getChild(player, "percent_owned"), "delta")
        ),
        is_starting: getChild(player, "starting_status")
          ? getChild(getChild(player, "starting_status"), "is_starting")
          : "N/A",
        ranks: getPlayerRanks(player),
        is_undroppable: getChild(player[0], "is_undroppable") === "1",
      };

      const ownership = getChild(player, "ownership");
      if (ownership) {
        playerObject.ownership = ownership;
      }

      result.push(playerObject);
    }
  }

  return result;
}

function getEligiblePositions(player: any) {
  const eligiblePositions: string[] = [];
  getChild(player[0], "eligible_positions").forEach((position: any) => {
    eligiblePositions.push(position.position);
  });
  return eligiblePositions;
}

/**
 * Will get the diamond cut value for the percent started or percent owned
 *
 * @param {*} player - The player JSON object
 * @param {string} percentType - The type of percent to get
 * (percent_started or percent_owned)
 * @param {string} cut - The cut type to get (diamond, platinum, gold, silver, bronze)
 * @return {number} - The diamond cut value
 */
function getPercentObject(
  player: any,
  percentType: string,
  cut = "diamond"
): number {
  const percentObject = getChild(player, percentType);
  let result = getChild(percentObject, "value");

  // if we can get the cut type, then we will return that instead of the general value
  const percentCuts = getChild(percentObject, percentType + "_cut_types");
  percentCuts.forEach((cutType: any) => {
    const cutTypeObject = cutType[percentType + "_cut_type"];
    if (getChild(cutTypeObject, "cut_type") === cut) {
      result = getChild(cutTypeObject, "value");
    }
  });

  return result;
}

/**
 * Will get the player ranks for the player
 *
 * @param {*} player - The player JSON object
 * @return {*} - The player ranks
 */
function getPlayerRanks(player: any): PlayerRanks {
  const rankTypeMap: { [key: string]: keyof PlayerRanks } = {
    L30: "last30Days",
    L14: "last14Days",
    PS7: "next7Days",
    PSR: "restOfSeason",
    L4W: "last4Weeks",
    PW: "projectedWeek",
    PN4W: "next4Weeks",
  };
  const result: PlayerRanks = {
    last30Days: -1,
    last14Days: -1,
    next7Days: -1,
    restOfSeason: -1,
    last4Weeks: -1,
    projectedWeek: -1,
    next4Weeks: -1,
  };

  const ranks = getChild(player, "player_ranks");
  for (const rank of ranks) {
    const rankType = rank.player_rank.rank_type;
    if (rankType in rankTypeMap) {
      const key = rankTypeMap[rankType];
      result[key] = parseStringToInt(rank.player_rank.rank_value);
    }
  }

  return result;
}
