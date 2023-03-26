import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { initStartingGoalies } from "../common/services/yahooAPI/yahooStartingGoalie.service";
import { taskQueueConfig } from "../dispatchSetLineup/dispatchSetLineup";

export const mockdispatchsetlineup = onTaskDispatched(
  taskQueueConfig,
  async (req) => {
    const uid: string = req.data.uid;
    const teams: string[] = req.data.teams;
    if (!uid) {
      console.log("No uid provided");
      return;
    }
    if (!teams) {
      console.log("No teams provided");
      return;
    }

    // fetch starting goalies, just to test how often it is called
    await initStartingGoalies();

    // approximate the time it takes to process a task (~3200ms from cloud logs, give or take)
    await new Promise((resolve) => setTimeout(resolve, 3500));
    console.log(
      `Successfully processed mock task for uid: ${uid} and teams: ${teams}`
    );
  }
);
