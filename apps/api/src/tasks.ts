/**
 * Cloud Tasks integration for job queueing and execution.
 * Provides both enqueue (from API) and handler (from Worker) surfaces.
 */

import { CloudTasksClient } from '@google-cloud/tasks';

export const tasksClient = new CloudTasksClient();

export interface TaskPayload {
  jobType: string;
  projectId: number;
  findingId?: number;
  handoffId?: number;
  actionRunId?: number;
  correlationId: string;
  retryCount: number;
}

export async function enqueueTask(payload: TaskPayload): Promise<void> {
  const queueName = process.env.CLOUD_TASKS_QUEUE ?? 'ai-visibility-jobs';
  const projectId = process.env.GCP_PROJECT_ID ?? 'ai-visibility';
  const location = process.env.GCP_LOCATION ?? 'europe-west1';
  const workerUrl = process.env.WORKER_URL ?? 'http://localhost:8080';

  const formattedParent = tasksClient.queuePath(projectId, location, queueName);

  await tasksClient.createTask({
    parent: formattedParent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${workerUrl}/tasks/process`,
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    },
  });
}
