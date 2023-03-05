import { LineupOptimizer } from "../classes/LineupOptimizer";
import { Team } from "../interfaces/Team";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// Use this to mock the global NHL_STARTING_GOALIES array where needed
const yahooStartingGoalieService = require("../../common/services/yahooAPI/yahooStartingGoalie.service");
jest.mock("../../common/services/yahooAPI/yahooStartingGoalie.service");

describe("Test LineupOptimizer Class NHL", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it("test already optimal roster", async function () {
    const roster: Team = require("./testRosters/NHL/optimalRoster.json");
    const npp = {};
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(isSuccessfullyOptimized).toEqual(true);
  });

  it("test one active C on bench, spare C slot", async function () {
    const roster: Team = require("./testRosters/NHL/oneMoveRequired.json");
    const npp = { "419.p.3737": "C" };
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    // expect(rosterModification.newPlayerPositions).toMatchObject(npp);
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(Object.values(rosterModification.newPlayerPositions)).not.toContain(
      "BN"
    );
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(isSuccessfullyOptimized).toEqual(true);
  });

  it("test one active C on bench, one non-active C on roster", async function () {
    const roster: Team = require("./testRosters/NHL/oneSwapRequired.json");
    const npp = { "419.p.6726": "BN", "419.p.3737": "C" };
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
  });

  it("test different active C on bench, one non-active C on roster", async function () {
    const roster: Team = require("./testRosters/NHL/oneSwapRequired2.json");
    const npp = { "419.p.6726": "BN", "419.p.7528": "C" };
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual(npp);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
  });

  it("test all players on bench", async function () {
    const roster: Team = require("./testRosters/NHL/allPlayersBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(Object.values(rosterModification.newPlayerPositions)).not.toContain(
      "BN"
    );
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "C"
      ).length
    ).toEqual(2);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "LW"
      ).length
    ).toEqual(2);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "RW"
      ).length
    ).toEqual(2);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "D"
      ).length
    ).toEqual(4);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "Util"
      ).length
    ).toEqual(3);
    expect(
      Object.values(rosterModification.newPlayerPositions).filter(
        (v) => v === "G"
      ).length
    ).toEqual(2);
  });

  it("test no players with games on active roster", async function () {
    const roster: Team = require("./testRosters/NHL/allRosterPlayersHaveNoGames.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(rosterModification.newPlayerPositions["419.p.3737"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.3737"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.7528"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.7528"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.6877"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.6877"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5441"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5441"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5391"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5391"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.6060"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.6060"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.4930"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.4930"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.7910"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.7910"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5992"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5992"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.6184"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.6184"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.4687"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.4687"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5020"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5020"]).not.toEqual(
      "BN"
    );
  });

  it("Lineup with worst players on roster, best players on bench", async function () {
    const roster: Team = require("./testRosters/NHL/BadOnRosterGoodOnBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);

    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved

    expect(rosterModification.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("BN");

    expect(rosterModification.newPlayerPositions["419.p.3737"]).toBeDefined();
    expect(["IR", "IR+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["419.p.3737"]
    );
    expect(rosterModification.newPlayerPositions["419.p.6726"]).toEqual("BN");

    expect(rosterModification.newPlayerPositions["419.p.5992"]).toBeDefined();
    expect(["IR", "IR+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["419.p.5992"]
    );
    expect(rosterModification.newPlayerPositions["419.p.5376"]).toBeDefined();
    expect(["IR", "IR+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["419.p.5376"]
    );
    expect(rosterModification.newPlayerPositions["419.p.4699"]).toBeDefined();
    expect(["IR", "IR+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["419.p.4699"]
    );
    expect(rosterModification.newPlayerPositions["419.p.5441"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.6060"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.7528"]).toEqual("BN");
  });

  it("Starting Goalies on Bench using NHL_STARTING_GOALIES array", async function () {
    const roster: Team = require("./testRosters/NHL/startingGoaliesOnBench2.json");
    // mock NHL_STARTING_GOALIES array
    jest
      .spyOn(yahooStartingGoalieService, "getNHLStartingGoalies")
      .mockReturnValue(["419.p.7593", "419.p.7163"]);
    expect(yahooStartingGoalieService.getNHLStartingGoalies()).toEqual([
      "419.p.7593",
      "419.p.7163",
    ]);

    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions["419.p.5161"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("G");
  });

  it("Starting Goalies on Bench with no NHL_STARTING_GOALIES array set", async function () {
    const roster: Team = require("./testRosters/NHL/startingGoaliesOnBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    // starting goalies array should not be defined since it was never set
    expect(
      yahooStartingGoalieService.getNHLStartingGoalies()
    ).not.toBeDefined();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions["419.p.5161"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("G");
  });

  it("One three way swap, specific result expected", async function () {
    const roster: Team = require("./testRosters/NHL/OneThreeWay.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved

    expect(rosterModification.newPlayerPositions["419.p.6060"]).toEqual("RW");
    expect(rosterModification.newPlayerPositions["419.p.5020"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.5376"]).toEqual("Util");
  });

  // The following tests involve injured player swaps
  it("Healthy not playing-player on IR, and IR on Bench", async function () {
    const roster: Team = require("./testRosters/NHL/HonIR&IRonBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6726"]).toEqual("IR");
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
  });

  it("Healthy high score on IR, and IR on Bench", async function () {
    const roster: Team = require("./testRosters/NHL/HHighScoreonIR&IRonBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toBeDefined();
    expect(["IR", "IR+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["419.p.6370"]
    );
    expect(rosterModification.newPlayerPositions["419.p.6726"]).toEqual("IR");
  });

  it("Healthy on IR, IR on BN, and empty roster spot", async function () {
    const roster: Team = require("./testRosters/NHL/HonIR&EmptyRosterSpot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    console.log(rosterModification.newPlayerPositions);

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      1
    );
  });

  it("Healthy high score on IR, IR on BN, and empty roster spot", async function () {
    const roster: Team = require("./testRosters/NHL/HHighScoreonIR&EmptyRosterSpot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toBeDefined();
    expect(["IR", "IR+", "BN"]).not.toContain(
      rosterModification.newPlayerPositions["419.p.6370"]
    );
    expect(
      Object.keys(rosterModification.newPlayerPositions).length
    ).toBeGreaterThan(1);
  });
});

describe("Test LineupOptimizer Class NBA", function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it("One healthy on IL, one IL on IL, one injured on roster", async function () {
    const roster: Team = require("./testRosters/NBA/1HonIL+1ILonRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = await lo.optimizeStartingLineup();
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
