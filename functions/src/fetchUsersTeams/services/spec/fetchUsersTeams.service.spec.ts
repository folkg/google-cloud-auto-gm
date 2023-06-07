import { fetchTeamsYahoo } from "../fetchUsersTeams.service";
import * as yahooAPI from "../../../common/services/yahooAPI/yahooAPI.service";
import { vi, describe, it, expect } from "vitest";

vi.mock("firebase-admin", () => ({
  initializeApp: vi.fn(),
  firestore: vi.fn(),
}));

describe.concurrent("fetchUsersTeams", () => {
  it("should return a list of teams v2", async () => {
    const input = require("./input.json");
    const expectedOutput = require("./output.json");

    const mockGetUserStandings = vi.spyOn(yahooAPI, "getUsersTeams");
    mockGetUserStandings.mockReturnValue(input);

    const teams = await fetchTeamsYahoo("test");
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/fetchUsersTeams/services/spec/outputv2.json",
    //   JSON.stringify(teams)
    // );

    expect(teams).toEqual(expectedOutput);
  });
});
