import { auth } from "firebase-admin";
import { logger } from "firebase-functions";

const sgMail = require("@sendgrid/mail");
require("dotenv").config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
  const msg = {
    to: "fantasyautocoach+feedback@gmail.com",
    from: "feedback@fantasyautocoach.com",
    replyTo: userEmail,
    subject: `[${feedbackType}] ${title}`,
    text: message,
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    logger.error("feedback email failed to send: ", error);
    throw new Error("Failed to send feedback email");
  }
  return true;
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

  const msg = {
    to: userEmailAddress,
    from: "customersupport@fantasyautocoach.com",
    subject: title,
    text: message,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    logger.log("user email failed to send: " + error);
    return false;
  }
}
