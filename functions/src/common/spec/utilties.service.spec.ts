import {
  getPacificEndOfDay,
  getPacificStartOfDay,
  getPacificTimeDateString,
} from "../services/utilities.service";
import { describe, test, expect } from "vitest";

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
});
