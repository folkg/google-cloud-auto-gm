import { vi, describe, it, test, expect, afterEach } from "vitest";
import {
  createPlayersTransactions,
  generateTopAvailablePlayerPromises,
  mergeTopAvailabePlayers,
} from "../services/processTransactions.service";
import { ITeamFirestore, ITeamOptimizer } from "../../common/interfaces/ITeam";
import * as yahooTopAvailablePlayersBuilder from "../../common/services/yahooAPI/yahooTopAvailablePlayersBuilder.service";
import { TopAvailablePlayers } from "../../common/services/yahooAPI/yahooTopAvailablePlayersBuilder.service";
import * as positionalScarcityService from "../../calcPositionalScarcity/services/positionalScarcity.service";

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

describe.todo("test getTransactions and postTransactions functions");

describe("test mergeTopAvailabePlayers function", () => {
  test("four MLB teams", async () => {
    const topAvailablePlayersPromise = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/topAvailablePlayersPromise1.json");
    const nflTopAvailablePlayersPromise = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/nflTopAvailablePlayersPromise1.json");
    const restTopAvailablePlayersPromise = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/restTopAvailablePlayersPromise1.json");
    const expectedOutput = require("../../dispatchSetLineup/spec/topAvailablePlayers/output/output1.json");

    const result = await mergeTopAvailabePlayers(
      topAvailablePlayersPromise,
      nflTopAvailablePlayersPromise,
      restTopAvailablePlayersPromise
    );

    expect(result).toEqual(expectedOutput);

    Object.keys(result).forEach((team) => {
      expect(result[team].length).toEqual(50);
    });
  });

  test("no teams adding players", async () => {
    const result = await mergeTopAvailabePlayers(
      Promise.resolve({}),
      Promise.resolve({}),
      Promise.resolve({})
    );

    expect(result).toEqual({});
  });
});

describe("generateTopAvailablePlayerPromises", () => {
  test("no teams adding players", () => {
    const teams: ITeamFirestore[] = [
      { allow_adding: false, game_code: "mlb" },
      { allow_adding: false, game_code: "nfl" },
      { allow_adding: false, game_code: "nhl" },
    ] as ITeamFirestore[];
    const expectedOutput = [
      Promise.resolve({}),
      Promise.resolve({}),
      Promise.resolve({}),
    ];
    const result = generateTopAvailablePlayerPromises(teams, "testuid");
    expect(result).toEqual(expectedOutput);
  });

  it("should call the API three times", () => {
    const teams: ITeamFirestore[] = [
      { allow_adding: true, game_code: "mlb" },
      { allow_adding: true, game_code: "nfl" },
    ] as ITeamFirestore[];
    const expectedOutput = [
      Promise.resolve({}),
      Promise.resolve({}),
      Promise.resolve({}),
    ];

    const fetchSpy = vi
      .spyOn(
        yahooTopAvailablePlayersBuilder,
        "fetchTopAvailablePlayersFromYahoo"
      )
      .mockResolvedValue({});

    const result = generateTopAvailablePlayerPromises(teams, "testuid");

    expect(result).toEqual(expectedOutput);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("should call the API two times (no NFL call)", () => {
    const teams: ITeamFirestore[] = [
      { allow_adding: true, game_code: "mlb" },
      { allow_adding: true, game_code: "nhl" },
    ] as ITeamFirestore[];
    const expectedOutput = [
      Promise.resolve({}),
      Promise.resolve({}),
      Promise.resolve({}),
    ];

    const fetchSpy = vi
      .spyOn(
        yahooTopAvailablePlayersBuilder,
        "fetchTopAvailablePlayersFromYahoo"
      )
      .mockResolvedValue({});

    const result = generateTopAvailablePlayerPromises(teams, "testuid");

    expect(result).toEqual(expectedOutput);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("should call the API two times (no rest call)", () => {
    const teams: ITeamFirestore[] = [
      { allow_adding: true, game_code: "nfl" },
      { allow_adding: true, game_code: "nfl" },
    ] as ITeamFirestore[];
    const expectedOutput = [
      Promise.resolve({}),
      Promise.resolve({}),
      Promise.resolve({}),
    ];

    const fetchSpy = vi
      .spyOn(
        yahooTopAvailablePlayersBuilder,
        "fetchTopAvailablePlayersFromYahoo"
      )
      .mockResolvedValue({});

    const result = generateTopAvailablePlayerPromises(teams, "testuid");

    expect(result).toEqual(expectedOutput);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("createPlayersTransactions with positionalScarcity", () => {
  const positionalScarcityServiceSpy = vi.spyOn(
    positionalScarcityService,
    "getScarcityOffsetsForTeam"
  );

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should drop the worst player (D) to make room for a player coming back from IR", async () => {
    positionalScarcityServiceSpy.mockResolvedValue({});

    const rosters: ITeamOptimizer[] = [
      require("../../dispatchSetLineup/spec/testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/topAvailablePlayersPromise2.json");

    const [
      resultDropTransactions,
      resultLineupChanges,
      resultAddSwapTransactions,
    ] = await createPlayersTransactions(rosters, addCandidates);

    const dropTransactionsPlayers = resultDropTransactions?.[0].flatMap(
      (t) => t.players
    );

    expect(dropTransactionsPlayers?.length).toEqual(1);
    expect(dropTransactionsPlayers?.[0]).toMatchObject({
      playerKey: "419.p.7155", // D
      transactionType: "drop",
    });

    expect(resultLineupChanges).toBeNull();
    expect(resultAddSwapTransactions).toBeNull();
  });

  it("should drop a different player (non-D) to make room for a player coming back from IR (with positional scarcity enabled)", async () => {
    positionalScarcityServiceSpy.mockResolvedValue({
      C: 50,
      LW: 50,
      RW: 50,
      D: 42, // D is more scarce, so these players will be protected slightly more
      G: 50,
    });

    const rosters: ITeamOptimizer[] = [
      require("../../dispatchSetLineup/spec/testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/topAvailablePlayersPromise2.json");

    const [
      resultDropTransactions,
      resultLineupChanges,
      resultAddSwapTransactions,
    ] = await createPlayersTransactions(rosters, addCandidates);

    const dropTransactionsPlayers = resultDropTransactions?.[0].flatMap(
      (t) => t.players
    );

    expect(dropTransactionsPlayers?.length).toEqual(1);
    expect(dropTransactionsPlayers?.[0]).toMatchObject({
      playerKey: "419.p.7528", // C
      transactionType: "drop",
    });

    expect(resultLineupChanges).toBeNull();
    expect(resultAddSwapTransactions).toBeNull();
  });

  it("should add top ranked player (SS) for a player moving to IR", async () => {
    positionalScarcityServiceSpy.mockResolvedValue({});

    const rosters: ITeamOptimizer[] = [
      require("../../dispatchSetLineup/spec/testRosters/MLB/free1spotILswap.json"),
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/topAvailablePlayersPromise2.json");

    const [
      resultDropTransactions,
      resultLineupChanges,
      resultAddSwapTransactions,
    ] = await createPlayersTransactions(rosters, addCandidates);

    const addSwapTransactionsPlayers = resultAddSwapTransactions?.[0].flatMap(
      (t) => t.players
    );

    expect(resultDropTransactions).toBeNull();

    expect(resultLineupChanges?.length).toEqual(1);
    expect(resultLineupChanges?.[0]).toMatchObject({
      newPlayerPositions: {
        "422.p.8918": "IL",
      },
    });

    expect(addSwapTransactionsPlayers?.length).toEqual(1);
    expect(addSwapTransactionsPlayers?.[0]).toMatchObject({
      playerKey: "422.p.10234", // SS
      transactionType: "add",
    });
  });

  it("should add a different player (non-SS) for a player moving to IR (with positional scarcity enabled)", async () => {
    positionalScarcityServiceSpy.mockResolvedValue({
      C: 1,
      "1B": 1,
      "2B": 1,
      "3B": 1,
      SS: 30, // SS is more plentiful, so these players will not be protected as much
      OF: 3,
      SP: 2,
      RP: 2,
      P: 4,
    });

    const rosters: ITeamOptimizer[] = [
      require("../../dispatchSetLineup/spec/testRosters/MLB/free1spotILswap.json"),
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/topAvailablePlayersPromise2.json");

    const [
      resultDropTransactions,
      resultLineupChanges,
      resultAddSwapTransactions,
    ] = await createPlayersTransactions(rosters, addCandidates);

    const addSwapTransactionsPlayers = resultAddSwapTransactions?.[0].flatMap(
      (t) => t.players
    );

    expect(resultDropTransactions).toBeNull();

    expect(resultLineupChanges?.length).toEqual(1);
    expect(resultLineupChanges?.[0]).toMatchObject({
      newPlayerPositions: {
        "422.p.8918": "IL",
      },
    });

    expect(addSwapTransactionsPlayers?.length).toEqual(1);
    expect(addSwapTransactionsPlayers?.[0]).toMatchObject({
      playerKey: "422.p.10666",
      transactionType: "add",
    });
  });

  it("should drop for returning-IL and swap multiple players for a better player in free agency", async () => {
    positionalScarcityServiceSpy.mockResolvedValue({});
    const dropTransactions = [
      {
        playerKey: "422.p.12351",
        transactionType: "drop",
        isInactiveList: false,
      },
    ];
    const addSwapTransactions = [
      {
        playerKey: "422.p.12037",
        transactionType: "add",
        isInactiveList: false,
        isFromWaivers: true,
      },
      {
        playerKey: "422.p.9558",
        transactionType: "drop",
        isInactiveList: false,
      },

      {
        playerKey: "422.p.10692",
        transactionType: "add",
        isInactiveList: false,
        isFromWaivers: true,
      },
      {
        playerKey: "422.p.11214",
        transactionType: "drop",
        isInactiveList: false,
      },
    ];

    const rosters: ITeamOptimizer[] = [
      require("../../dispatchSetLineup/spec/problematicAddDrop/moveILtoBN-lineup.json"),
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/problematicAddDrop/healthyOnILShouldBeIllegal-addcandidates.json");

    const [
      resultDropTransactions,
      resultLineupChanges,
      resultAddSwapTransactions,
    ] = await createPlayersTransactions(rosters, addCandidates);

    const dropTransactionsPlayers = resultDropTransactions?.[0].flatMap(
      (t) => t.players
    );
    const addSwapTransactionsPlayers = resultAddSwapTransactions?.[0].flatMap(
      (t) => t.players
    );

    expect(dropTransactionsPlayers?.length).toEqual(1);
    expect(dropTransactionsPlayers).toMatchObject(dropTransactions);

    expect(resultLineupChanges?.length).toEqual(1);
    expect(resultLineupChanges?.[0]).toMatchObject({
      newPlayerPositions: {
        "422.p.9558": "BN",
      },
    });

    expect(addSwapTransactionsPlayers?.length).toEqual(4);
    expect(addSwapTransactionsPlayers).toMatchObject(addSwapTransactions);
  });
  it("should drop for returning-IL and swap multiple players for a better player in free agency (with positional scarcity enabled)", async () => {
    positionalScarcityServiceSpy.mockResolvedValue({
      C: 50,
      "1B": 50,
      "2B": 50,
      "3B": 50,
      SS: 30,
      OF: 30,
      SP: 70,
      RP: 70,
      P: 70,
    });
    const dropTransactions = [
      {
        playerKey: "422.p.12351", // "eligible_positions": ["1B", "2B", "3B", "SS", "OF", "Util"], PO: 23
        transactionType: "drop",
        isInactiveList: false,
      },
    ];
    const addSwapTransactions = [
      {
        playerKey: "422.p.10891",
        transactionType: "add",
        isInactiveList: false,
        isFromWaivers: true,
      },
      {
        playerKey: "422.p.11853",
        transactionType: "drop",
        isInactiveList: false,
      },
    ];

    const rosters: ITeamOptimizer[] = [
      require("../../dispatchSetLineup/spec/problematicAddDrop/moveILtoBN-lineup.json"),
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/problematicAddDrop/healthyOnILShouldBeIllegal-addcandidates.json");

    const [
      resultDropTransactions,
      resultLineupChanges,
      resultAddSwapTransactions,
    ] = await createPlayersTransactions(rosters, addCandidates);

    const dropTransactionsPlayers = resultDropTransactions?.[0].flatMap(
      (t) => t.players
    );
    const addSwapTransactionsPlayers = resultAddSwapTransactions?.[0].flatMap(
      (t) => t.players
    );

    expect(dropTransactionsPlayers?.length).toEqual(1);
    expect(dropTransactionsPlayers).toMatchObject(dropTransactions);

    expect(resultLineupChanges?.length).toEqual(1);
    expect(resultLineupChanges?.[0]).toMatchObject({
      newPlayerPositions: {
        "422.p.9558": "BN",
      },
    });

    expect(addSwapTransactionsPlayers?.length).toEqual(2);
    expect(addSwapTransactionsPlayers).toMatchObject(addSwapTransactions);
  });

  it("should not pick up a QB if the team is already at QB capacity (1) even with no dedicated QB spot(Q/W/R/T)", async () => {
    // TODO: Do we need a positional scrcity offset for QBs in this league? Or just don't pick them up?
    // 414.l.240994
    positionalScarcityServiceSpy.mockResolvedValue({
      WR: 0,
      RB: 3,
      TE: 1,
      DEF: 7,
      "Q/W/R/T": 3,
    });

    const rosters: ITeamOptimizer[] = [
      require("../../common/services/yahooAPI/spec/testYahooLineupJSON/output/NFLLineupEmptySpot.json")[0],
    ];
    const addCandidates: TopAvailablePlayers = require("../../dispatchSetLineup/spec/topAvailablePlayers/promises/nflReal.json");
    const qbAddCandidates = addCandidates["414.l.240994.t.12"]
      .filter((p) => p.display_positions.includes("QB"))
      .map((p) => p.player_key);

    const [, , resultAddSwapTransactions] = await createPlayersTransactions(
      rosters,
      addCandidates
    );

    const addSwapTransactionsPlayers = resultAddSwapTransactions?.[0].flatMap(
      (t) => t.players
    );

    // expect that we do not add any QB players since we already have 2 on the roster (max capacity is 1)
    const areQBsAdded = addSwapTransactionsPlayers?.some(
      (t) =>
        t.transactionType === "add" && qbAddCandidates.includes(t.playerKey)
    );
    expect(areQBsAdded).toBeFalsy();
  });
});
