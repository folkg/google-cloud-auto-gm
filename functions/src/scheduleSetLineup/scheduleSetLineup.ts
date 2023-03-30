import { onSchedule } from "firebase-functions/v2/scheduler";
import { scheduleSetLineup } from "./services/scheduleSetLineup.service";

export const schedulesetlineup = onSchedule("55 * * * *", async (event) => {
  await scheduleSetLineup();
});
