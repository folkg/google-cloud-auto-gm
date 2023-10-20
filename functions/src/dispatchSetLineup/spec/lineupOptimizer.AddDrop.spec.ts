import { describe, expect, it, test, vi } from "vitest";
import { ITeamOptimizer } from "../../common/interfaces/ITeam.js";
import { LineupOptimizer } from "../classes/LineupOptimizer.js";
import { PlayerCollection } from "../classes/PlayerCollection.js";
import spacetime from "spacetime";

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

describe("Unit Test LineupOptimizer Simple Drop Players", function () {
  test("No drops allowed Daily", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noDropsAllowed.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  test("No drops allowed Daily", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noAllowDroppingPropertyOnTeam.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  test("No drops required Daily", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/noDropsRequired.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  test("Injured player illegally on IR, don't drop anyone", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/injuredPlayerIllegallyOnIR.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  test("Drop player with lowest score for 'Probable' player Daily", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScore.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("419.p.7155");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("No drops required Intraday", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/noDropsRequired.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  test("Try dropping critical position G", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/tryDropCriticalPositionG.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    // drop second worst player since G is a critical position
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("419.p.7528");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score for 'Probable' player Intraday", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/dropPlayerWithLowestScore.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("419.p.7528");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop two players with lowest score for 'Questionable' and 'Game Time Decision' players Intraday", function () {
    const roster: ITeamOptimizer = require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("419.p.7528");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("419.p.7903");
    expect(playerTransactions?.[1].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score for 'Probable' player NBA", function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequired.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with third lowest score (lowest are non-editable for today) - NBA", function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredThirdLowest.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("418.p.5864");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score - same as above but roster is now daily change - NBA", function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredLowest.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score for 'Game Time Decision' player NBA", function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/oneDropRequiredWithOptimization.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });

  test("Drop two player with lowest score for 'Game Time Decision' players NBA", function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/IntradayDrops/twoDropsRequiredWithOptimization.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("418.p.5893");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("418.p.6567");
    expect(playerTransactions?.[1].players[0].transactionType).toEqual("drop");
  });

  test("Drop player with lowest score for 'Game Time Decision' player NBA weekly", function () {
    const roster: ITeamOptimizer = require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json");
    const lo = new LineupOptimizer(roster);
    lo.generateDropPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("418.p.6047");
    expect(playerTransactions?.[0].players[0].transactionType).toEqual("drop");
  });
});

describe("Add players", () => {
  test("set addCandidates with MLB players (with one candidate already pending waivers)", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/pendingTransactionsAddCandidates.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");

    const loAddCandidates: PlayerCollection | undefined = lo.addCandidates;
    // expect(loAddCandidates?.players.length).toBeGreaterThanOrEqual(25);
    // expect(loAddCandidates?.players.length).toBeLessThanOrEqual(50);
    expect(loAddCandidates?.players.length).toEqual(41);
  });

  it("should free 0 roster spots before adding players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/optimal.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const numEmptyRosterSpots = lo.teamObject.currentEmptyRosterSpots;

    expect(numEmptyRosterSpots).toEqual(0);
  });

  it("should free 3 roster spots (injured players to IL) before adding players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free3spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const numEmptyRosterSpots = lo.teamObject.currentEmptyRosterSpots;

    expect(numEmptyRosterSpots).toEqual(3);
  });

  it("should add top 3 players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free3spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: true,
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
            isFromWaivers: false,
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
            isFromWaivers: false,
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
            isFromWaivers: false,
          },
        ],
      },
    ]);
  });

  it("should not add top player (422.p.10234) because they are LTIR", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates2.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10666");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.12024");
  });

  it("should not add top player (422.p.10234) because they are already in a current pending claim", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsWpendTrans.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10666");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.12024");
  });

  it("should only add one player, since pending waiver claim will fill extra spot", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsWpendTrans2.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(1);
  });

  it("should not use faab when picking up two waiver players due to league settings", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/noFaab.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates3.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    // expect(playerTransactions?.length).toEqual(2);
    // expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10620");
    // expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.10233");

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: false,
      },
      {
        isFaabRequired: false,
      },
    ]);
  });

  it("should add top 1B and top C (from waivers) because they are empty roster positions", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/2unfilledPositions(C,1B).json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates3.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    // expect(playerTransactions?.length).toEqual(2);
    // expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10620");
    // expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.10233");

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: true,
            isInactiveList: false,
            playerKey: "422.p.10620",
            transactionType: "add",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: true,
            isInactiveList: false,
            playerKey: "422.p.10233",
            transactionType: "add",
          },
        ],
      },
    ]);
  });

  it("should add top 1B, then top player, since 1B and C are empty, but no C available", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/2unfilledPositions(C,1B).json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10620");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.10234");
  });

  it("should add worse, boosted player (422.p.12024, 3B) because they have critical position (1B, 3B, RP) eligibility", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates4.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.12024");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.10666");
  });

  it("should add best player (422.p.10666) because 3B is not a critical position, so no one has enough boost", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots2.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates4.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10666");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.12024");
  });

  it("should add no one because we have an illegal lineup (healthy on IR)", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/illegalLineup1.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  it("should add no one because we have an illegal lineup (too many at C)", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/illegalLineup2.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  it("should add no one because we have no add candidates", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots.json");
    const lo = new LineupOptimizer(roster);
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  it("Should not add top player because they are on waivers, and user's waiver setting is off", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsWaiversOff.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates3.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.9573");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.9331");
  });

  it("Should add top player because they are on waivers, and user's waiver setting is on", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spots.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates3.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10234");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.10666");
  });

  it("Should add two players because there are no max transactions limits", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsPace1.json"); // 1/50 season, 1/5 weekly
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(2);
    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10234");
    expect(playerTransactions?.[1].players[0].playerKey).toEqual("422.p.10666");
  });

  it("Should add no one because pace for season is bad before we begin", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsPace3.json"); // 26/50 season, 0/5 weekly
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  it("Should add only one player because pace for season is good, but pace for week is bad after first add", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsPace4.json"); // 2/50 season, 2/5 weekly
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(1);
  });

  // This means:
  // 0. if next day changes, fetch tomorrow's lineup
  // 1. generateDropPlayerTransactions(). - Make any dropped players disappear from lineup. Make is_editable = false and selected_position = null?
  // This selected_position = null may require modifying some other functions. It should also not count as a lineupChange.
  // 2. generateAddPlayerTransactions().
  // 3. if (lo.lineupChanges) then put lineup changes
  // 4. generateAddDropPlayerTransactions(). Should not drop IL for Healthy, so no lineup changes should be required.
  // 5. if (lo.playerTransactions) post player transactions
  // 6. if same day changes, refetch
});

describe("Swap players", () => {
  const swapsFromOptimalLineup = [
    {
      isFaabRequired: true,
      players: [
        {
          isFromWaivers: false,
          isInactiveList: false,
          playerKey: "422.p.10234",
          transactionType: "add",
        },
        {
          isInactiveList: false,
          playerKey: "422.p.9096",
          transactionType: "drop",
        },
      ],
    },
    {
      isFaabRequired: true,
      players: [
        {
          isFromWaivers: false,
          isInactiveList: false,
          playerKey: "422.p.10666",
          transactionType: "add",
        },
        {
          isInactiveList: false,
          playerKey: "422.p.8918",
          transactionType: "drop",
        },
      ],
    },
    {
      isFaabRequired: true,
      players: [
        {
          isFromWaivers: false,
          isInactiveList: false,
          playerKey: "422.p.12024",
          transactionType: "add",
        },
        {
          isInactiveList: false,
          playerKey: "422.p.12339",
          transactionType: "drop",
        },
      ],
    },
    {
      isFaabRequired: true,
      players: [
        {
          isFromWaivers: false,
          isInactiveList: false,
          playerKey: "422.p.9573",
          transactionType: "add",
        },
        {
          isInactiveList: false,
          playerKey: "422.p.9557",
          transactionType: "drop",
        },
      ],
    },
  ];

  it("should swap worst player for best player 3 different times (respecting almostCriticalPositions)", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/optimal.json"); // almostCriticalPositions = [ 'C', '1B', '2B', '3B', 'SS', 'RP' ]
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    expect(playerTransactions).toMatchObject(swapsFromOptimalLineup);
  });

  it("should make no swaps because all addCandidates are worse than current players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/optimal.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates5.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  it("should prioritize top 1B and top C (from waivers) because they are empty roster positions (instead of BPA) (still drop worst player)", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/2unfilledPositions(C,1B).json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates3.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: true,
            isInactiveList: false,
            playerKey: "422.p.10620",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9096",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: true,
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.8918",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: true,
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.12339",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: true,
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9557",
            transactionType: "drop",
          },
        ],
      },
    ]);
  });

  it("should not add top player (422.p.10234) because they are already in a current pending claim", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsWpendTrans.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.8918",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.12339",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.9573",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9557",
            transactionType: "drop",
          },
        ],
      },
    ]);
  });

  it("should move the worst IL player to empty BN spot, and then drop them for the best add candidate", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/swapILPlayer.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(lineupChanges).toEqual({
      coveragePeriod: "2023-04-07",
      coverageType: "date",
      newPlayerPositions: {
        "422.p.9096": "BN",
      },
      teamKey: "422.l.119198.t.3",
    });
    expect(playerTransactions).toMatchObject(swapsFromOptimalLineup);
  });

  it("should swap the worst IL player to BN, and then drop them for the best add candidate", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/swapILPlayer2.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(lineupChanges).toEqual({
      coveragePeriod: "2023-04-07",
      coverageType: "date",
      newPlayerPositions: {
        "422.p.9096": "BN",
        "422.p.90962": "IL",
      },
      teamKey: "422.l.119198.t.3",
    });
    expect(playerTransactions).toMatchObject(swapsFromOptimalLineup);
  });

  it("should move the worst IL player to BN, BN to IL+ in 3-way, and then drop them for the best add candidate", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/swapILPlayer3.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(lineupChanges).toEqual({
      coveragePeriod: "2023-04-07",
      coverageType: "date",
      newPlayerPositions: {
        "422.p.9096": "BN",
        "422.p.90962": "IL+",
        "422.p.90963": "IL",
      },
      teamKey: "422.l.119198.t.3",
    });
    expect(playerTransactions).toMatchObject(swapsFromOptimalLineup);
  });

  it("Should add no one because pace for season is bad before we begin", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsPace3.json"); // 26/50 season, 0/5 weekly
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
  });

  it("Should add only one player because pace for season is good, but pace for week is bad after first add", () => {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific"); // 45% through season, 42.8% through week
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);

    const roster: ITeamOptimizer = require("./testRosters/MLB/free2spotsPace4.json"); // 2/50 season, 2/5 weekly
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions?.length).toEqual(1);
  });
});

describe("Combination Drops or Adds", () => {
  it("should add / drop no one because lineup is optimal", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/optimal.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(playerTransactions).toEqual(null);
    expect(lineupChanges).toEqual(null);
  });

  it("should add / drop no one because we can move IL player to free spot on bench", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/moveILtoBN.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(playerTransactions).toEqual(null);
    expect(lineupChanges).toEqual(null);

    const lo2 = new LineupOptimizer(roster);
    lo2.optimizeStartingLineup();
    const rosterModifications = lo2.lineupChanges;

    expect(rosterModifications?.newPlayerPositions["422.p.10660"]).toEqual(
      "BN"
    );
  });
  it("should add / drop no one because we can swap IL player with injured on roster", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/swapILtoBN.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(playerTransactions).toEqual(null);
    expect(lineupChanges).toEqual(null);

    const lo2 = new LineupOptimizer(roster);
    lo2.optimizeStartingLineup();
    const rosterModifications = lo2.lineupChanges;

    expect(rosterModifications?.newPlayerPositions["422.p.10660"]).toEqual(
      "BN"
    );
    expect(rosterModifications?.newPlayerPositions["422.p.106602"]).toEqual(
      "IL"
    );
  });

  it("should drop one player because we have healthy player on IL and no free spots", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/DropWorstPlayer.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    expect(playerTransactions?.[0].players[0].playerKey).toEqual(
      "422.p.106602"
    );
    expect(lineupChanges).toEqual(null);

    const roster2: ITeamOptimizer = require("./testRosters/MLB/DropWorstPlayer-refetched.json");
    const lo2 = new LineupOptimizer(roster2);
    lo2.optimizeStartingLineup();
    const rosterModifications = lo2.lineupChanges;

    expect(rosterModifications?.newPlayerPositions["422.p.10660"]).toEqual(
      "BN"
    );
  });

  it("should add one player because we have one healthy on IL, and two injured on roster", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/AddBestPlayer.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    const playerTransactions = lo.playerTransactions;
    const lineupChanges = lo.lineupChanges;

    // expect that the drop function would swap the IL with a healthy
    expect(lineupChanges?.newPlayerPositions["422.p.10660"]).toEqual("IL");
    expect(lineupChanges?.newPlayerPositions["422.p.106602"]).toEqual("BN");

    // expect that the add function would move an IL+ to the IL+
    expect(lineupChanges?.newPlayerPositions["422.p.11014"]).toEqual("IL+");

    expect(playerTransactions?.[0].players[0].playerKey).toEqual("422.p.10234");
  });

  it("should drop worst player for healthy on IL, then swap next-worst players for best players", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/dropWorst.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    lo.generateSwapPlayerTransactions();
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toMatchObject([
      {
        players: [
          {
            isInactiveList: false,
            playerKey: "422.p.8918",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.12339",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9557",
            transactionType: "drop",
          },
        ],
      },
    ]);
  });

  it("should move a player to IL for a new add, then swap worst player for the next-best player two times", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free1spot.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    lo.generateSwapPlayerTransactions();
    const lineupChanges = lo.lineupChanges;
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.12339",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9557",
            transactionType: "drop",
          },
        ],
      },
    ]);
    expect(lineupChanges).toEqual({
      coveragePeriod: "2023-04-07",
      coverageType: "date",
      newPlayerPositions: {
        "422.p.10660": "IL",
      },
      teamKey: "422.l.119198.t.3",
    });
  });

  it("should move the worst player (Alex Cobb) to IL for a new add, then move them back to BN and swap that worst player for the next-best player", () => {
    const roster: ITeamOptimizer = require("./testRosters/MLB/free1spotILswap.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./topAvailablePlayers/MLBCandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    lo.generateSwapPlayerTransactions();
    const lineupChanges = lo.lineupChanges;
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toMatchObject([
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.12339",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9557",
            transactionType: "drop",
          },
        ],
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.9331",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.8918",
            transactionType: "drop",
          },
        ],
      },
    ]);
    expect(lineupChanges).toEqual({
      coveragePeriod: "2023-04-07",
      coverageType: "date",
      newPlayerPositions: {
        "422.p.11014": "IL",
      },
      teamKey: "422.l.119198.t.3",
    });
  });

  it("should not put roster over max size (no dropped players should be moved to IL)", () => {
    const roster: ITeamOptimizer = require("./problematicAddDrop/1overMax-lineup.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./problematicAddDrop/1overMax-addcandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    lo.generateSwapPlayerTransactions();
    const lineupChanges = lo.lineupChanges;
    const playerTransactions = lo.playerTransactions;

    const droppedPlayers = playerTransactions?.map(
      (t) => t.players.find((p) => p.transactionType === "drop")?.playerKey
    );

    if (droppedPlayers) {
      for (const playerKey of droppedPlayers) {
        playerKey &&
          expect(lineupChanges?.newPlayerPositions[playerKey]).not.toEqual(
            "IL"
          );
      }
    }
  });

  it("should not attempt swaps because the lineup is illegal (healthy on IL)", () => {
    const roster: ITeamOptimizer = require("./problematicAddDrop/healthyOnILShouldBeIllegal-lineup.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./problematicAddDrop/healthyOnILShouldBeIllegal-only-addcandidates.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    lo.generateSwapPlayerTransactions();
    const lineupChanges = lo.lineupChanges;
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
    expect(lineupChanges).toEqual(null);
  });

  it("should not pick up extra P because we are at max capacity", () => {
    const roster: ITeamOptimizer = require("./problematicAddDrop/tooManyPitchers-lineup.json");
    const lo = new LineupOptimizer(roster);
    lo.addCandidates = require("./problematicAddDrop/tooManyPitchers-ac.json");
    lo.generateDropPlayerTransactions();
    lo.generateAddPlayerTransactions();
    lo.generateSwapPlayerTransactions();
    const lineupChanges = lo.lineupChanges;
    const playerTransactions = lo.playerTransactions;

    expect(playerTransactions).toEqual(null);
    expect(lineupChanges).toEqual(null);
  });
});
