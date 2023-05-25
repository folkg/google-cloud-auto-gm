import { getFunctions, TaskQueue } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { getFunctionUrl } from "../common/services/utilities.service";

export const addmocktaskstoqueue = onRequest(async (req, res) => {
  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("lineup-mockdispatchsetlineup");
    targetUri = await getFunctionUrl("lineup-mockdispatchsetlineup");
  } catch (error) {
    logger.error("Error getting task queue. ", error);
    return;
  }

  // Start enqueuing mock tasks
  const numTasks = parseInt(req.query.numTasks as string) || 10;
  const mockEnqueues: any[] = [];
  for (let i = 0; i < numTasks; i++) {
    const uid = `user_${i}`;
    const teams = [`team_${i}_1`, `team_${i}_2`];
    mockEnqueues.push(queue.enqueue({ uid, teams }, { uri: targetUri }));
  }

  try {
    // Wait for all mock tasks to be enqueued
    await Promise.all(mockEnqueues);
    logger.log("Successfully enqueued mock tasks");
  } catch (error) {
    logger.error("Error enqueuing or processing tasks: ", error);
  }
  res.end();
});
