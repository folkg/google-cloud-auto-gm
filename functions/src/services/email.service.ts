import { auth } from "firebase-admin";
import { createTransport } from "nodemailer";

const transporter = createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_GMAIL_ADDRESS,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Send an email to the AutoCoach gmail account from the client UI
 *
 * @export
 * @async
 * @param {string} userEmail The email address of the user sending the email
 * @param {string} feedbackType The type of feedback being sent
 * @param {string} title The title of the email
 * @param {string} message The message of the email
 * @return {Promise<boolean>} The result of the email send
 */
export async function sendFeedbackEmail(
  userEmail: string,
  feedbackType: string,
  title: string,
  message: string
): Promise<boolean> {
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

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.log("feedback email failed to send: " + error);
    return false;
  }
}

/**
 * Send an email to the user
 *
 * @export
 * @async
 * @param {string} uid The user id of the user to send the email to
 * @param {string} title The title of the email
 * @param {string} message The message of the email
 * @return {Promise<boolean>} The result of the email send
 */
export async function sendUserEmail(
  uid: string,
  title: string,
  message: string
): Promise<boolean> {
  const userEmailAddress = (await auth().getUser(uid)).email;
  if (!userEmailAddress) {
    throw new Error("User does not have a valid email address");
  }

  const mailOptions = {
    from:
      "'Fantasy AutoCoach " +
      "' <" +
      process.env.NODEMAILER_GMAIL_ADDRESS +
      ">",
    to: userEmailAddress,
    subject: title,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.log("user email failed to send: " + error);
    return false;
  }
}
