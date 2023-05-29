import { fetchTeamsYahoo } from "../fetchUsersTeams.service";

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("fetchUsersTeams", () => {
  it("should return a list of teams v2", async () => {
    const input = require("./input.json");
    const expectedOutput = require("./output.json");

    const mockGetUserStandings = jest.spyOn(
      require("../../../common/services/yahooAPI/yahooAPI.service"),
      "getUsersTeams"
    );
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
