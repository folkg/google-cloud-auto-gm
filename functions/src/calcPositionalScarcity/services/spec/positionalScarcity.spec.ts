import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ITeamFirestore } from "../../../common/interfaces/ITeam";
import * as constants from "../../../common/helpers/constants";
import {
  clearScarcityOffsets,
  generateFetchPlayerPromises,
  getReplacementLevels,
  getScarcityOffsetsForGame,
  getScarcityOffsetsForLeague,
  recalculateScarcityOffsetsForAll,
} from "../positionalScarcity.service";
import * as yahooAPI from "../../../common/services/yahooAPI/yahooAPI.service";
import * as firestoreService from "../../../common/services/firebase/firestore.service";

const numbersArr100 = Array.from({ length: 100 }, (_, i) => 100 - i);
const playersF = require("./playersF.json");
const playersD = require("./playersD.json");
const playersG = require("./playersG.json");
// This changes sometimes, I want to make sure it's always the same for testing, since this isn't the focus
const maxExtraSpy = vi
  .spyOn(constants, "POSITIONAL_MAX_EXTRA_PLAYERS", "get")
  .mockReturnValue({
    mlb: { P: 6 },
    nfl: { QB: 1, K: 0, DEF: 0 },
    nba: {},
    nhl: { G: 3 },
  });

// Stop calls to Firestore
vi.spyOn(firestoreService, "getRandomUID").mockResolvedValue("1");
const updatePositionalScarcityOffsetSpy = vi
  .spyOn(firestoreService, "updatePositionalScarcityOffset")
  .mockResolvedValue();

describe("getReplacementLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("should return the correct replacement level for a team with no compound positions", () => {
    const team = {
      game_code: "nhl",
      roster_positions: {
        C: 2,
        LW: 2,
        RW: 2,
        D: 4,
        G: 2,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      C: 24,
      LW: 24,
      RW: 24,
      D: 48,
      G: 24,
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
  it("should return the correct replacement level for a team with compound positions", () => {
    const team = {
      game_code: "nhl",
      roster_positions: {
        C: 2,
        LW: 2,
        RW: 2,
        D: 4,
        G: 2,
        Util: 4,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      C: 33.6,
      LW: 33.6,
      RW: 33.6,
      D: 67.2,
      G: 24,
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
  it("should return the correct replacement level for a team with compound positions and BN positions", () => {
    const team = {
      game_code: "nhl",
      roster_positions: {
        C: 2,
        LW: 2,
        RW: 2,
        D: 4,
        G: 2,
        Util: 4,
        BN: 5,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      C: 43.6,
      LW: 43.6,
      RW: 43.6,
      D: 87.2,
      G: 34,
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
  it("should return the correct replacement level for a team with compound positions, BN positions, and max extra players (NFL)", () => {
    const team = {
      game_code: "nfl",
      roster_positions: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        "W/R/T": 1,
        "Q/W/R/T": 1,
        K: 1,
        DEF: 1,
        BN: 6,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      QB: 24,
      RB: 57.6,
      WR: 57.6,
      TE: 28.8,
      K: 12,
      DEF: 12,
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
  it("should return the correct replacement level for a team with compound positions (with no subs listed) and BN positions (NHL)", () => {
    const team = {
      game_code: "nhl",
      roster_positions: {
        F: 6,
        D: 4,
        G: 2,
        BN: 6,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      F: 108,
      D: 72,
      G: 36,
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
  it("should return the correct replacement level for a team with compound positions (subs and no subs), BN positions, and max extra players (NHL)", () => {
    // set this artifical value just to test the functionality
    maxExtraSpy.mockReturnValueOnce({
      nhl: { D: 2, G: 1 },
    });

    const team = {
      game_code: "nhl",
      roster_positions: {
        F: 6,
        D: 4,
        G: 2,
        Util: 3,
        BN: 6,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      D: 72, // 48 + 14.4 (from Util) = 62.4 + 24 (from BN) = 86.4 ! Too much. Should cap at 72, then allocate elsewhere.
      G: 36, // 24 + (72 - 9.6) * (2/8) = 39.6 ! Too much. Should cap at 36, then allocate elsewhere.
      F: 144, // 72 + 21.6 (from Util) = 93.6 + the rest = 144
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
  it("should return the correct replacement level for a team with compound positions (with no subs listed), BN positions, and max extra players (MLB)", () => {
    // set this artifically low just to test the functionality
    maxExtraSpy.mockReturnValueOnce({
      mlb: { P: 2 },
    });

    const team = {
      game_code: "mlb",
      roster_positions: {
        C: 1,
        "1B": 1,
        "2B": 1,
        "3B": 1,
        SS: 1,
        OF: 3,
        P: 9,
        BN: 10,
      },
      num_teams: 12,
    } as unknown as ITeamFirestore;
    const expectedOutput = {
      C: 24,
      "1B": 24,
      "2B": 24,
      "3B": 24,
      SS: 24,
      OF: 72,
      P: 132,
    };

    const result = getReplacementLevels(team);
    for (const position in expectedOutput) {
      expect(result[position]).toBeCloseTo(expectedOutput[position], 2);
    }
  });
});

describe("recalculateScarcityOffsetsForAll", () => {
  const league = "nhl";
  const scarcityOffsets = {
    nhl: {
      F: numbersArr100,
      D: numbersArr100,
      G: numbersArr100,
    },
  };

  let getPositionalScarcityOffsetsSpy;
  let getTopPlayersGeneralSpy;

  beforeAll(() => {
    getTopPlayersGeneralSpy = vi.spyOn(yahooAPI, "getTopPlayersGeneral");
    getPositionalScarcityOffsetsSpy = vi.spyOn(
      firestoreService,
      "getPositionalScarcityOffsets"
    );
  });

  beforeEach(() => {
    getTopPlayersGeneralSpy.mockResolvedValue({});
    getPositionalScarcityOffsetsSpy.mockResolvedValue(scarcityOffsets);
    clearScarcityOffsets();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not call getTopPlayersGeneral if there is no scarcity offset", async () => {
    getPositionalScarcityOffsetsSpy.mockResolvedValueOnce(null);

    await recalculateScarcityOffsetsForAll();

    const scarcityOffsetArray = getScarcityOffsetsForGame(league);
    expect(scarcityOffsetArray).toEqual({});

    expect(getTopPlayersGeneralSpy).not.toHaveBeenCalled();
    expect(updatePositionalScarcityOffsetSpy).not.toHaveBeenCalled();
  });

  it("should not call getTopPlayersGeneral if scarcity offset is empty", async () => {
    getPositionalScarcityOffsetsSpy.mockResolvedValueOnce({});

    await recalculateScarcityOffsetsForAll();

    const scarcityOffsetArray = getScarcityOffsetsForGame(league);
    expect(scarcityOffsetArray).toEqual({});

    expect(getTopPlayersGeneralSpy).not.toHaveBeenCalled();
    expect(updatePositionalScarcityOffsetSpy).not.toHaveBeenCalled();
  });

  it("should call getTopPlayersGeneral 12 times (3 positions x 4 calls each (100 / 25))", async () => {
    await recalculateScarcityOffsetsForAll();

    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(12);
  });

  it("should call for multiple leagues", async () => {
    const scarcityOffsets = {
      nfl: { QB: [0, 1] },
      nhl: { G: [1] },
      nba: {},
      mlb: { P: [0, 1], OF: numbersArr100 },
    };
    getPositionalScarcityOffsetsSpy.mockResolvedValue(scarcityOffsets);

    await recalculateScarcityOffsetsForAll();

    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(7);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "nfl", "QB", 0);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "nhl", "G", 0);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "mlb", "P", 0);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "mlb", "OF", 0);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "mlb", "OF", 25);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "mlb", "OF", 50);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", "mlb", "OF", 75);
  });

  it("should call updatePositionalScarcityOffset 3 times for 3 positions in SCARCITY_OFFSETS when there are players returned", async () => {
    getTopPlayersGeneralSpy
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersG)
      .mockResolvedValueOnce(playersG)
      .mockResolvedValueOnce(playersG)
      .mockResolvedValueOnce(playersG);

    await recalculateScarcityOffsetsForAll();

    const scarcityOffsetArray = getScarcityOffsetsForGame(league);
    expect(scarcityOffsetArray).toEqual(scarcityOffsets[league]);

    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(3);
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledWith(
      league,
      "F",
      expect.arrayContaining([expect.any(Number)])
    );
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledWith(
      league,
      "D",
      expect.arrayContaining([expect.any(Number)])
    );
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledWith(
      league,
      "G",
      expect.arrayContaining([expect.any(Number)])
    );
  });

  it("should not call updatePositionalScarcityOffset if there are no players returned", async () => {
    await recalculateScarcityOffsetsForAll();

    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(0);
  });

  it("should not call updatePositionalScarcityOffset for a position if a fetch fails", async () => {
    getTopPlayersGeneralSpy
      .mockRejectedValueOnce("Could not fetch F players")
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersF)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersD)
      .mockResolvedValueOnce(playersG)
      .mockResolvedValueOnce(playersG)
      .mockRejectedValueOnce("Could not fetch G players")
      .mockResolvedValueOnce(playersG);
    await recalculateScarcityOffsetsForAll();

    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(1);
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledWith(
      league,
      "D",
      expect.arrayContaining([expect.any(Number)])
    );
  });
});
describe("getScarcityOffsetsForLeague", () => {
  const team = {
    game_code: "nhl",
    roster_positions: {
      F: 6,
      D: 4,
      G: 2,
    },
    num_teams: 12,
  } as unknown as ITeamFirestore;
  const league = team.game_code;
  const replacementLevels = { F: 72, D: 48, G: 24 };

  let getPositionalScarcityOffsetsSpy;

  beforeAll(() => {
    getPositionalScarcityOffsetsSpy = vi
      .spyOn(firestoreService, "getPositionalScarcityOffsets")
      .mockResolvedValue({
        nhl: {
          F: numbersArr100,
          D: numbersArr100,
          G: numbersArr100,
          Util: numbersArr100,
          LW: numbersArr100,
        },
      });
  });

  beforeEach(() => {
    clearScarcityOffsets();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return the correct offsets for team with 3 positions", async () => {
    const result = await getScarcityOffsetsForLeague(league, replacementLevels);
    // replacement level for F is 72, D is 48, G is 24. Get the ownership at each index.
    expect(result).toEqual({
      F: 29,
      D: 53,
      G: 77,
    });

    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(0);
  });

  it("should return empty if loading/calculating scarcity offsets fails", async () => {
    getPositionalScarcityOffsetsSpy.mockResolvedValueOnce(null);
    // Don't actually fetch players from yahoo
    vi.spyOn(yahooAPI, "getTopPlayersGeneral").mockResolvedValue({});

    const result = await getScarcityOffsetsForLeague(league, replacementLevels);

    expect(result).toEqual({});
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(0);
  });

  it("should call updatePositionalScarcityOffset if there are no offsets for a position (RW)", async () => {
    const getTopPlayersGeneralSpy = vi
      .spyOn(yahooAPI, "getTopPlayersGeneral")
      .mockResolvedValue(playersF);
    await getScarcityOffsetsForLeague(league, {
      F: 72,
      D: 48,
      G: 24,
      RW: 24,
    });
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(1);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith("1", league, "RW", 0);
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(1);
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledWith(
      league,
      "RW",
      expect.arrayContaining([expect.any(Number)])
    );
  });

  it("should call updatePositionalScarcityOffset if there are not enough offsets for a position (F)", async () => {
    const getTopPlayersGeneralSpy = vi
      .spyOn(yahooAPI, "getTopPlayersGeneral")
      .mockResolvedValue(playersF);
    await getScarcityOffsetsForLeague(league, {
      F: 101,
      D: 48,
      G: 24,
    });
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(5);
    const position = "F";
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith(
      "1",
      league,
      position,
      0
    );
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith(
      "1",
      league,
      position,
      100
    );
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledTimes(1);
    expect(updatePositionalScarcityOffsetSpy).toHaveBeenCalledWith(
      league,
      "F",
      expect.arrayContaining([expect.any(Number)])
    );
  });

  it("should return all arrays (existing and new(F, RW)) in descending order", async () => {
    vi.spyOn(yahooAPI, "getTopPlayersGeneral").mockResolvedValue(playersF);
    await getScarcityOffsetsForLeague(league, {
      F: 101,
      D: 48,
      G: 24,
      RW: 24,
    });

    const scarcityOffsetArray = getScarcityOffsetsForGame(league);
    for (const position in scarcityOffsetArray) {
      const pOffsets = scarcityOffsetArray[position];
      expect(pOffsets[0]).toBeGreaterThan(pOffsets[pOffsets.length - 1]);
    }
  });
});

describe("generateFetchPlayerPromises", () => {
  const uid = "testuid";
  const position = "F";
  const gameCode = "nhl";
  let getTopPlayersGeneralSpy;

  beforeAll(() => {
    vi.restoreAllMocks();
    getTopPlayersGeneralSpy = vi
      .spyOn(yahooAPI, "getTopPlayersGeneral")
      .mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return an array of 1 promise if count is <= 25", async () => {
    const count = 25;
    const result = generateFetchPlayerPromises(uid, position, gameCode, count);

    expect(result).toHaveLength(1);

    await Promise.all(result);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(1);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith(
      uid,
      gameCode,
      position,
      0
    );
  });
  it("should return an array of 2 promises if count is 26", async () => {
    const count = 26;
    const result = generateFetchPlayerPromises(uid, position, gameCode, count);

    expect(result).toHaveLength(2);

    await Promise.all(result);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(2);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith(
      uid,
      gameCode,
      position,
      0
    );
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledWith(
      uid,
      gameCode,
      position,
      25
    );
  });
  it("should return an empty array if count is 0", async () => {
    const count = 0;
    const result = generateFetchPlayerPromises(uid, position, gameCode, count);

    expect(result).toHaveLength(0);

    await Promise.all(result);
    expect(getTopPlayersGeneralSpy).toHaveBeenCalledTimes(0);
  });
});