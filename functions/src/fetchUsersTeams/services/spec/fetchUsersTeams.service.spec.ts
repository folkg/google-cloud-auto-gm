import { fetchTeamsYahoo } from "../fetchUsersTeams.service";

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));
const mockGetAllStandings = jest.spyOn(
  require("../../../common/services/yahooAPI/yahooAPI.service"),
  "getAllStandings"
);

describe("fetchUsersTeams", () => {
  it("should return a list of teams", async () => {
    const input = require("./input.json");
    const expectedOutput = require("./output.json");
    mockGetAllStandings.mockReturnValue(input);

    const teams = await fetchTeamsYahoo("test");
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/fetchUsersTeams/services/spec/output.json",
    //   JSON.stringify(teams)
    // );

    expect(teams).toEqual(expectedOutput);
  });
});
