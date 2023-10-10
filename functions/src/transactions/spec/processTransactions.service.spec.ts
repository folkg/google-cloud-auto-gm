import { vi, describe, it, test, expect } from "vitest";
import {
  generateTopAvailablePlayerPromises,
  mergeTopAvailabePlayers,
} from "../services/processTransactions.service";
import { ITeamFirestore } from "../../common/interfaces/ITeam";
import * as yahooTopAvailablePlayersBuilder from "../../common/services/yahooAPI/yahooTopAvailablePlayersBuilder.service";

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

describe.concurrent("test mergeTopAvailabePlayers function", () => {
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

describe.concurrent("generateTopAvailablePlayerPromises", () => {
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
