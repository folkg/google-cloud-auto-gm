import { getFunctions, TaskQueue } from "firebase-admin/functions";
import { onRequest } from "firebase-functions/v2/https";
import { getFunctionUrl } from "../common/services/utilities.service";

export const addmocktaskstoqueue = onRequest(async (req, res) => {
  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("mockdispatchsetlineup");
    targetUri = await getFunctionUrl("mockdispatchsetlineup");
  } catch (err: Error | any) {
    console.error("Error getting task queue. " + err.message);
    return;
  }

  // Start enqueuing mock tasks
  const numTasks = req.query.numTasks || 10;
  const mockEnqueues: any[] = [];
  for (let i = 0; i < numTasks; i++) {
    const uid = `user_${i}`;
    const teams = [`team_${i}_1`, `team_${i}_2`];
    mockEnqueues.push(queue.enqueue({ uid, teams }, { uri: targetUri }));
  }

  try {
    // Wait for all mock tasks to be enqueued
    await Promise.all(mockEnqueues);
    console.log("Successfully enqueued mock tasks");
  } catch (err: Error | any) {
    console.error("Error enqueuing or processing tasks: " + err.message);
  }
});
