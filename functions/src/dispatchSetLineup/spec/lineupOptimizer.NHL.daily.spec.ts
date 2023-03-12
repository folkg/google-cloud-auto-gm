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

describe("Test LineupOptimizer Class NHL Daily", function () {
  // beforeEach(() => {
  //   jest.resetModules();
  // });

  // afterEach(() => {
  //   // restore the spy created with spyOn
  //   jest.restoreAllMocks();
  // });

  // *** Test Optimization of Lineup using healthy players ***
  it("test already optimal roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/optimalRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);

    expect(rosterModification.newPlayerPositions).toEqual({});
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
  });

  it("test one active C on bench, spare C slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/oneMoveRequired.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.3737": "C",
    });
    expect(Object.values(rosterModification.newPlayerPositions)).not.toContain(
      "BN"
    );
  });

  it("test one active C on bench, one non-active C on roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/oneSwapRequired.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.6726": "BN",
      "419.p.3737": "C",
    });
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
  });

  it("test different active C on bench, one non-active C on roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/oneSwapRequired2.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.6726": "BN",
      "419.p.7528": "C",
    });
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
  });

  it("test two active players on bench, two non-active players on roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/twoSwapsRequired.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions["419.p.3737"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.3737"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions["419.p.5992"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.5992"]).not.toEqual(
      "BN"
    );
    expect(rosterModification.newPlayerPositions).toMatchObject({
      "419.p.6726": "BN",
      "419.p.6385": "BN",
    });
  });

  it("test two active players on bench, one non-active player on roster, one empty roster spot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/oneSwapOneMoveRequired.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();
    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions).toMatchObject({
      "419.p.6726": "BN",
      "419.p.6877": "LW",
    });
    expect(rosterModification.newPlayerPositions["419.p.3737"]).toBeDefined();
    expect(rosterModification.newPlayerPositions["419.p.3737"]).not.toEqual(
      "BN"
    );
  });

  it("test all players on bench", function () {
    const roster: Team = require("./testRosters/NHL/Daily/allPlayersBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
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

  it("test no players with games on active roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/allRosterPlayersHaveNoGames.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
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

  it("Lineup with worst players on roster, best players on bench", function () {
    const roster: Team = require("./testRosters/NHL/Daily/BadOnRosterGoodOnBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
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

  it("Starting Goalies on Bench using NHL_STARTING_GOALIES array", function () {
    const roster: Team = require("./testRosters/NHL/Daily/startingGoaliesOnBench2.json");
    // mock NHL_STARTING_GOALIES array
    jest
      .spyOn(yahooStartingGoalieService, "getNHLStartingGoalies")
      .mockReturnValue(["419.p.7593", "419.p.7163"]);
    expect(yahooStartingGoalieService.getNHLStartingGoalies()).toEqual([
      "419.p.7593",
      "419.p.7163",
    ]);

    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(
      rosterModification.newPlayerPositions["419.p.6370"]
    ).not.toBeDefined(); // on IR+, should not be moved
    expect(rosterModification.newPlayerPositions["419.p.5161"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.7163"]).toEqual("G");
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("G");

    // reset the mock configuration
    jest
      .spyOn(yahooStartingGoalieService, "getNHLStartingGoalies")
      .mockRestore();
  });

  it("Starting Goalies on Bench with no NHL_STARTING_GOALIES array set", function () {
    const roster: Team = require("./testRosters/NHL/Daily/startingGoaliesOnBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
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

  // *** Test Illegal players that should be resolved ***
  it("Healthy not-playing, low score, player on IR, and IR on Bench", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HonIR&IRonBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(["IR", "IR+"]).toContain(
      rosterModification.newPlayerPositions["419.p.6726"]
    );
  });

  it("Healthy high score on IR, and IR on Bench", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HHighScoreonIR&IRonBench.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["C", "Util"]).toContain(
      rosterModification.newPlayerPositions["419.p.6370"]
    );
    expect(["IR", "IR+"]).toContain(
      rosterModification.newPlayerPositions["419.p.6726"]
    );
  });

  it("Healthy on IR, IR on BN, and empty roster spot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HonIR&EmptyRosterSpot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    // expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.6370": "BN",
    });
  });

  it("Healthy high score on IR, IR on BN, and empty roster spot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HHighScoreonIR&EmptyRosterSpot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
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

  it("Healthy player on IR, and IR+ on Bench with open IR+ slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HonIR&IR+OnRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6726"]).toEqual("IR+");
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
  });

  it("Healthy player on IR, and IR+ on Bench with no open IR+ slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HonIR&IR+OnRosterNoOpenSlot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({});
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      0
    );
  });

  it("Healthy player on IR+, and IR on Bench with open IR slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HonIR+&IROnRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6726"]).toEqual("IR");
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
  });

  it("Healthy player on IR+, and IR on Bench with no open IR slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/HonIR+&IROnRosterNoOpenSlot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toMatchObject({
      "419.p.6726": "IR+",
    });
    expect(["C", "Util"]).toContain(
      rosterModification.newPlayerPositions["419.p.6370"]
    );
  });

  it("IR+ player on IR, open IR+ slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/IR+onIR&OpenIR+Slot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.6370": "IR+",
    });
  });

  it("IR+ player on IR, no open IR+ slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/IR+onIR&NoOpenIR+Slot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  it("IR+ player on IR, no open IR+ slot, IR player on BN", function () {
    const roster: Team = require("./testRosters/NHL/Daily/IR+onIR&NoOpenIR+Slot&IRonBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6726"]).toEqual("IR");
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      2
    );
  });

  it("NA player on IR, no NA slots on roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/NAonIR&NoNASlotsOnRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  it("NA player on IR, no NA slots on roster, empty roster position", function () {
    const roster: Team = require("./testRosters/NHL/Daily/NAonIR&NoNASlotsOnRoster&EmptyRosterPosition.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      1
    );
  });

  //TODO: FAIL: This test is failing, but it should be passing. Need to fix
  it("NA player on IR, open NA slot on roster", function () {
    const roster: Team = require("./testRosters/NHL/Daily/NAonIR&OpenNASlotOnRoster.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("NA");
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      1
    );
  });

  it("NA player on IR, no open NA slot on roster, IR player on Goalie", function () {
    const roster: Team = require("./testRosters/NHL/Daily/NAonIR&NoOpenNASlotOnRoster&IRonBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["IR", "IR+"]).toContain(
      rosterModification.newPlayerPositions["419.p.7163"]
    );
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("G");
  });

  it("Two healthy players on IR, one empty roster spot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2HealthyOnIR&1EmptyRosterSpot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.7593": "BN",
    });
  });

  it("Two healthy players on IR, one empty roster spot, one IR player on BN", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2HealthyOnIR&1EmptyRosterSpot&1IRonBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["C", "Util", "BN"]).toContain(
      rosterModification.newPlayerPositions["419.p.6370"]
    );
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("BN");
    expect(["IR", "IR+"]).toContain(
      rosterModification.newPlayerPositions["419.p.6385"]
    );
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      3
    );
  });

  it("Two healthy players on IR, two IR on bench", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2HealthyOnIR&2IRonBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(Object.keys(rosterModification.newPlayerPositions).length).toEqual(
      4
    );
    expect(rosterModification.newPlayerPositions["419.p.7593"]).toEqual("BN");
    expect(rosterModification.newPlayerPositions["419.p.6370"]).toEqual("BN");
    expect(["IR", "IR+"]).toContain(
      rosterModification.newPlayerPositions["419.p.6385"]
    );
    expect(["IR", "IR+"]).toContain(
      rosterModification.newPlayerPositions["419.p.6726"]
    );
  });

  it("Two healthy players on IR, one IR player on BN, no IR+ slots open", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2HealthyOnIR&1IRonBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.7593": "BN",
      "419.p.6385": "IR",
    });
  });

  it("Two healthy players on IR, one IR+ player on BN", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2HealthyOnIR&1IR+onBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.7593": "BN",
      "419.p.6385": "IR+",
    });
  });

  it("Two healthy players on IR, two IR+ player on BN", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2HealthyOnIR&2IR+onBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.7593": "BN",
      "419.p.6370": "BN",
      "419.p.6385": "IR+",
      "419.p.6726": "IR+",
    });
  });

  // TODO: Fail. Fix.
  it("One healthy player on IR, one IR+ player on BN, one IR player on IR+, no spare IR+ slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/1HealthyOnIR&1IR+onBN&1IRonIR+&NoSpareIR+Slot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.6370": "BN",
      "419.p.6385": "IR+",
      "419.p.63702": "IR",
    });
  });

  // TODO: Fail. Fix.
  it("Two IR players on IR+, one IR+ player on BN, no spare IR+ slot, 1 spare IR slot, One HonIR", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2IRonIR+&1IR+onBN&NoSpareIR+Slot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["C", "Util", "BN"]).toContain(
      rosterModification.newPlayerPositions["419.p.37372"]
    );
    expect(rosterModification.newPlayerPositions["419.p.5376"]).toEqual("IR+");
    expect([
      rosterModification.newPlayerPositions["419.p.6370"],
      rosterModification.newPlayerPositions["419.p.63702"],
    ]).toContain("IR");
    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  // TODO: Fail. Fix.
  it("Two IR players on IR+, one IR+ player on BN, all other players on BN, One HonIR", function () {
    const roster: Team = require("./testRosters/NHL/Daily/2IRonIR+&1IR+onBN&AllOtherPlayersOnBN.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(["C", "Util", "BN"]).toContain(
      rosterModification.newPlayerPositions["419.p.37372"]
    );
    expect(rosterModification.newPlayerPositions["419.p.5376"]).toEqual("IR+");
    expect([
      rosterModification.newPlayerPositions["419.p.6370"],
      rosterModification.newPlayerPositions["419.p.63702"],
    ]).toContain("IR");
    expect(rosterModification.newPlayerPositions).toEqual({});
  });

  it("One healthy player on IR, one IR player on BN, one IR+ player on IR, one spare IR+ slot", function () {
    const roster: Team = require("./testRosters/NHL/Daily/1HealthyOnIR&1IRonBN&1IR+onIR&1SpareIR+Slot.json");
    const lo = new LineupOptimizer(roster);
    const rosterModification = lo.optimizeStartingLineup();
    const isSuccessfullyOptimized = lo.isSuccessfullyOptimized();

    expect(isSuccessfullyOptimized).toEqual(true);
    expect(rosterModification.newPlayerPositions).toEqual({
      "419.p.6370": "BN",
      "419.p.6385": "IR",
      "419.p.63702": "IR+",
    });
  });

  // TODO: If we are going to move IR players up in the lineup, we need to test a better player on IR swapping with a worse IR palyer on bench
});
