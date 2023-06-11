import { describe, expect, it, vi } from "vitest";
import {
  sendFeedbackEmail,
  sendUserEmail,
} from "../services/email/email.service";

vi.mock("firebase-admin", () => ({
  initializeApp: () => {},
  auth: () => ({
    getUser: () => ({
      email: "graemefolk@gmail.com",
      displayName: "Graeme Folk",
    }),
  }),
}));

describe.skip("Integration test EmailService", () => {
  it("should actually send email via SendGrid", async () => {
    const result = await sendFeedbackEmail(
      "test@email.com",
      "Bug Report",
      "More Features",
      "I like the app, but I want more features."
    );
    expect(result).toBeTruthy();
  });

  it("should send an error email via SendGrid", async () => {
    const uid = "12345";
    const result = await sendUserEmail(
      uid,
      "Urgent Action Required: Yahoo Authentication Error",
      [
        "<strong>Your Yahoo access has expired and your lineups are no longer being managed by Fantasy AutoCoach.</strong>",
        "Please visit the Fantasy AutoCoach website below and sign in again with Yahoo so that we can continue to " +
          "manage your teams. Once you sign in, you will be re-directed to your dashabord and we " +
          "will have everything we need to continue managing your teams. Thank you for your assistance, and we " +
          "apologize for the inconvenience.",
      ],
      "Sign In",
      "https://fantasyautocoach.com/"
    );
    expect(result).toBeTruthy();
  });
});
