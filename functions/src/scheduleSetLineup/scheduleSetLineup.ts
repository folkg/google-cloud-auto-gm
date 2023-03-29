import { onSchedule } from "firebase-functions/v2/scheduler";
import { scheduleSetLineup } from "./services/scheduleSetLineup.service";

// TODO: Refactor this function to be more readable and maintainable
// function will run every hour at 55 minutes past the hour
export const schedulesetlineup = onSchedule("55 * * * *", async (event) => {
  await scheduleSetLineup();
});
