import { sendFeedbackEmail } from "../services/email.service";

xdescribe("Integration test EmailService", () => {
  it("should actually send email vi SendGrid", async () => {
    const result = await sendFeedbackEmail(
      "test@email.com",
      "Bug Report",
      "More Features",
      "I like the app, but I want more features."
    );
    expect(result).toBeTruthy();
  });
});
