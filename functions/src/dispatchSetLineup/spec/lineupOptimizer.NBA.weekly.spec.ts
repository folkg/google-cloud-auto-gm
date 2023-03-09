import { LineupOptimizer } from "../classes/LineupOptimizer";
import { Team } from "../interfaces/Team";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("Test LineupOptimizer Class NBA Weekly", function () {
  // beforeEach(() => {
  //   jest.resetModules();
  // });

  it("Optimal Lineup", async function () {
    const roster: Team = require("./testRosters/NBA/Weekly/optimalRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  // *** Test Optimization of Lineup using healthy players ***
  // 1 player to move into 1 empty roster spot
  it("1 player to move into 1 empty roster spot", async function () {
    const roster: Team = require("./testRosters/NBA/Weekly/1PlayerToMoveInto1EmptyRosterSpot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "418.p.5295": "PF",
    });
  });

  // 1 swap involving 2 players
  it("1 swap involving 2 players", async function () {
    const roster: Team = require("./testRosters/NBA/Weekly/1SwapInvolving2Players.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["SG", "G", "SF", "F", "Util"]).toContain(
      rosterModification.newPlayerPositions["418.p.6021"]
    );
    expect(rosterModification.newPlayerPositions["418.p.3930"]).toEqual("BN");
  });

  // different 1 swap involving 2 players
  it("differet 1 swap involving 2 players", async function () {
    const roster: Team = require("./testRosters/NBA/Weekly/1SwapInvolving2Players(2).json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["SF", "PF", "F", "Util"]).toContain(
      rosterModification.newPlayerPositions["418.p.5295"]
    );
    expect(rosterModification.newPlayerPositions["418.p.4725"]).toEqual("BN");
  });
  // two swaps required
  // 1 swap required, 1 player to move into 1 empty roster spot
  // all players on bench
  // lineup with worst players on roster, best players on bench

  // *** Test Optimization of Lineup using injured players ***
  // high score IL player on IL, low score IL player on bench, no spare IL slot (expect swap)
  // high score IL+ player on IL+, low score IL+ player on bench, one spare IL+ slot (expect swap)
  // high score IL+ player on IL+, low score IL player on bench, no spare IL+ slot (expect swap)
  // high score IL+ player on IL+, low score IL player on bench, one spare IL and one IL+ slot (expect swap)
  // high score IL player on IL, low score IL+ player on bench, one spare IL+ slot (expect IL+ player to IL+, IL player to bench)

  // *** Test Illegal players that should be resolved ***
  // low score healthy player on IL, IL player on bench (expect swap, healthy player to BN)
  // high score healthy player on IL, IL player on bench (expect swap, healthy player to roster)
  // healthy player on IL, IL on BN, 1 empty roster spot (expect healthy player moved to BN)
  // healthy player on IL, IL+ player on BN, 1 empty IL+ slot (expect healthy player moved to BN, IL+ player to IL+)
  // healthy player on IL, IL+ player on BN, no empty IL+ slot (expect no move)
  // healthy player on IL+, IL player on BN, 1 empty IL slot (expect healthy player moved to BN, IL player to IL)
  // healthy player on IL+, IL player on BN, no empty IL slot (expect swap)
  // IL+ player on IL, no open IL+ slot (expect no move)
  // IL+ player on IL, open IL+ slot (expect IL+ player to IL+)
  // IL+ player on IL, no open IL+ slot, IL player on BN (expect swap)
  // Two healthy players on IL, one empty roster spot (expect better player to roster)
  // Two healthy player on IL, one IL player on BN (expect better player to roster, IL player to IL)
  // Two healthy players on IL, one empty roster spot, one IL player on BN (expect both healthy players to BN, IL player to IL)
  // Two healthy players on IL, two IL on BN (expect all healthy players to BN, IL players to IL)
  // Two healthy players on IL, one IL+ player on BN, one empty IL+ slot (expect better player to roster, IL+ player to IL+)
  // Two healthy players on IL, two IL+ player on BN, two empty IL+ slots (expect both healthy players to BN, IL+ players to IL+)
  // One healthy player on IL, one IL+ player on BN, one IL player on IL+, no spare IL+ slot (expect IL player to IL, IL+ player to IL+, healthy player to BN)
  // One healthy player on IL, one IL+ player on IL, one IL player on BN, one spare IL+ slot (expect IL+ player to IL+, IL player to IL, healthy player to BN)
});
