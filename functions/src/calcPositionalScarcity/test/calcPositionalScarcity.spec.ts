import { beforeEach, describe, expect, it, vi } from "vitest";
import { ITeamFirestore } from "../../common/interfaces/ITeam";
import { getReplacementLevels } from "../calcPositionalScarcity";
import * as constants from "../../dispatchSetLineup/helpers/constants";

// This changes sometimes, I want to make sure it's always the same for testing, since this isn't the focus
const maxExtraSpy = vi
  .spyOn(constants, "POSITIONAL_MAX_EXTRA_PLAYERS", "get")
  .mockReturnValue({
    mlb: { P: 6 },
    nfl: { QB: 1, K: 0, DEF: 0 },
    nba: {},
    nhl: { G: 3 },
  });

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
