import { onSchedule } from "firebase-functions/v2/scheduler";
import { scheduleWeeklyLeagueTransactions } from "./services/scheduleWeeklyLeagueTansactions.service";

// hour 03 = 8pm PST / 9pm PDT Sunday. Somewhat arbitrary, just wanted later Sunday.
export const scheduleweeklyleaguetransactions = onSchedule(
  "0 03 * * MON",
  async () => {
    await scheduleWeeklyLeagueTransactions();
  }
);
