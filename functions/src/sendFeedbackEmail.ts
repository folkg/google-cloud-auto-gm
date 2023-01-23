import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createTransport } from "nodemailer";

const transporter = createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_GMAIL_ADDRESS,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendfeedbackemail = onCall(async (request) => {
  const uid = request.auth?.uid;
  const data = request.data;
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "User must be logged in to send feedback email"
    );
  }
  if (!data) {
    throw new HttpsError(
      "invalid-argument",
      "Data must be provided to send feedback email"
    );
  }
  const { userEmail, feedbackType, title, message } = data;
  if (!userEmail || !feedbackType || !title || !message) {
    throw new HttpsError(
      "invalid-argument",
      "All fields must be provided to send feedback email"
    );
  }

  const mailOptions = {
    from:
      "'AutoCoach " +
      feedbackType +
      "' <" +
      process.env.NODEMAILER_GMAIL_ADDRESS +
      ">",
    replyTo: userEmail,
    to: process.env.NODEMAILER_GMAIL_ADDRESS,
    subject: "[" + feedbackType + "] " + title,
    text: message,
  };

  console.log(mailOptions);

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.log("feedback email failed to send: " + error);
    return false;
  }
});
