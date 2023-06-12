import { describe, expect, it, vi } from "vitest";
import { ITeamOptimizer } from "../../common/interfaces/ITeam.js";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";

// mock firebase-admin
vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn(),
  };
});
vi.mock("firebase-admin/app", () => {
  return {
    getApps: vi.fn(() => ["null"]),
    initializeApp: vi.fn(),
  };
});

describe("Test LineupOptimizer Class NBA Daily", function () {
  // NBA should be very similar to NHL, so we'll just test a few things
  it("One healthy on IL, one IL on IL, one injured on roster", async function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/Daily/1HonIL+1ILonRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved

    expect(rosterModification.newPlayerPositions["418.p.5482"]).toBeDefined();
    expect(["IL", "IL+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["418.p.5482"]
    );
    expect(rosterModification.newPlayerPositions["418.p.5864"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["418.p.5864"]).toEqual("IL");
  });
});
