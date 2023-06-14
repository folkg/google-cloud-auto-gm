import { vi, describe, test, expect } from "vitest";
import { TopAvailablePlayers } from "../services/yahooTopAvailablePlayersBuilder.service";
import { mergeTopAvailabePlayers } from "../services/setLineups.service";

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

describe("test mergeTopAvailabePlayers function", () => {
  test("four MLB teams", async () => {
    const topAvailablePlayersPromise: Promise<TopAvailablePlayers> = require("./topAvailablePlayers/promises/restTopAvailablePlayersPromise1.json");
    const nflTopAvailablePlayersPromise: Promise<TopAvailablePlayers> = require("./topAvailablePlayers/promises/nflTopAvailablePlayersPromise1.json");
    const restTopAvailablePlayersPromise: Promise<TopAvailablePlayers> = require("./topAvailablePlayers/promises/restTopAvailablePlayersPromise1.json");
    const expectedOutput: TopAvailablePlayers = require("./topAvailablePlayers/output/output1.json");

    const result = await mergeTopAvailabePlayers(
      topAvailablePlayersPromise,
      nflTopAvailablePlayersPromise,
      restTopAvailablePlayersPromise
    );

    expect(result[0]).toEqual(expectedOutput[0]);
    expect(result[1]).toEqual(expectedOutput[1]);
    expect(result[2]).toEqual(expectedOutput[2]);
    expect(result[3]).toEqual(expectedOutput[3]);
  });
});
