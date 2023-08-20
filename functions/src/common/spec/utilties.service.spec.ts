import { describe, expect, test, vi } from "vitest";
import {
  getPacificEndOfDay,
  getPacificStartOfDay,
  getPacificTimeDateString,
  getProgressBetween,
  getWeeklyProgressPacific,
  isTodayPacificTime,
} from "../services/utilities.service.js";
import spacetime from "spacetime";

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

describe.concurrent("Utilities test", function () {
  test("single digit month, day ", function () {
    const date = new Date(2020, 0, 3, 1, 1, 1);
    const result = getPacificTimeDateString(date);
    expect(result).toEqual("2020-01-03");
  });
  test("double digit month, day ", function () {
    const date = new Date(2023, 10, 13, 1, 1, 1);
    const result = getPacificTimeDateString(date);
    expect(result).toEqual("2023-11-13");
  });
  test("today", function () {
    const date = new Date();
    const result = getPacificTimeDateString(date);
    // allow for a one day difference
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(result).toEqual(expect.stringMatching(today + "|" + yesterday));
  });
  test("getPacificStartOfDay", function () {
    const date = new Date(2020, 0, 3, 1, 1, 1).toISOString();
    const result = getPacificStartOfDay(date);
    expect(result).toEqual(1578009600000);
  });
  test("getPacificEndOfDay", function () {
    const date = new Date(2020, 0, 3, 1, 1, 1).toISOString();
    const result = getPacificEndOfDay(date);
    expect(result).toEqual(1578095999999);
  });

  test("getWeeklyProgressPacific", function () {
    // mock spacetime.now() to return a specific date
    const mockSpacetime = spacetime("June 15, 2023", "Canada/Pacific");
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);
    const expected = 3 / 7;

    const result = getWeeklyProgressPacific();

    expect(result).toBeCloseTo(expected, 2);
  });

  test("getProgressBetween", function () {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific");
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);
    const startDate = spacetime("June 21, 2023", "Canada/Pacific").epoch;
    const endDate = spacetime("June 23, 2023", "Canada/Pacific").epoch;

    const result = getProgressBetween(startDate, endDate);

    expect(result).toEqual(0.5);
  });

  test("getProgressBetween again", function () {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific");
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);
    const startDate = spacetime("June 21, 2023", "Canada/Pacific").epoch;
    const endDate = spacetime("June 25, 2023", "Canada/Pacific").epoch;

    const result = getProgressBetween(startDate, endDate);

    expect(result).toEqual(0.25);
  });

  test("isTodayPacificTime true", function () {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific").time(
      "11:30am"
    );
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);
    const date = spacetime("June 22, 2023", "Canada/Pacific").time(
      "11:30pm"
    ).epoch;

    const result = isTodayPacificTime(date);

    expect(result).toEqual(true);
  });

  test("isTodayPacificTime false", function () {
    const mockSpacetime = spacetime("June 22, 2023", "Canada/Pacific");
    vi.spyOn(spacetime, "now").mockReturnValue(mockSpacetime);
    const date = spacetime("June 21, 2023", "Canada/Pacific").epoch;

    const result = isTodayPacificTime(date);

    expect(result).toEqual(false);
  });
});
