import { LineupOptimizer } from "../classes/LineupOptimizer";
import { ITeam } from "../interfaces/ITeam";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

xdescribe("Test LineupOptimizer Class NBA Daily", function () {
  // NBA should be very similar to NHL, so we'll just test a few things
  beforeEach(() => {
    jest.resetModules();
  });

  it("One healthy on IL, one IL on IL, one injured on roster", async function () {
    const roster: ITeam = require("./testRosters/NBA/Daily/1HonIL+1ILonRoster.json");
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
