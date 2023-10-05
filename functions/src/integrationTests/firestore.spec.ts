import { describeIfIntegrationTesting } from "./setupTests";

import { it, expect } from "vitest";
import {
  getPositionalScarcityOffsets,
  getRandomUID,
} from "../common/services/firebase/firestore.service";

describeIfIntegrationTesting("Firestore Integration", () => {
  it("should return uid", async () => {
    const result = await getRandomUID();
    expect(result).toBeDefined();
  });

  it("should return positional scarcity offsets", async () => {
    const result = await getPositionalScarcityOffsets();
    console.log(result);
    expect(result).toBeDefined();
    for (const league in result) {
      if (Object.hasOwn(result, league)) {
        for (const position in result[league]) {
          if (Object.hasOwn(result[league], position)) {
            expect(Array.isArray(result[league][position])).toBe(true);
          }
        }
      }
    }
  });
});
