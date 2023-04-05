import { sendFeedbackEmail, sendUserEmail } from "../services/email.service";
jest.mock("firebase-admin", () => ({
  initializeApp: () => {},
  auth: () => ({
    getUser: () => ({
      email: "graemefolk@gmail.com",
      displayName: "Graeme Folk",
    }),
  }),
}));

xdescribe("Integration test EmailService", () => {
  xit("should actually send email vi SendGrid", async () => {
    const result = await sendFeedbackEmail(
      "test@email.com",
      "Bug Report",
      "More Features",
      "I like the app, but I want more features."
    );
    expect(result).toBeTruthy();
  });

  xit("should send an error email via SendGrid", async () => {
    const uid = "12345";
    const result = await sendUserEmail(
      uid,
      "Urgent Action Required: Yahoo Authentication Error",
      [
        "Your Yahoo access has expired and your lineups are no longer being managed by Fantasy AutoCoach.",
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
