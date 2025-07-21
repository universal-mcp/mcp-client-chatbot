import {
  CodeRunnerResult,
  CodeWorkerEvent,
  CodeWorkerRequest,
  CodeWorkerResult,
} from "./code-runner.interface";
import { safePythonRun } from "./safe-python-run";

self.onmessage = async (event) => {
  const { code, timeout = 300000, id } = event.data as CodeWorkerRequest;
  const engine = safePythonRun;
  const result = await engine({
    code,
    timeout,
    onLog(entry) {
      const logEvent: CodeWorkerEvent = {
        id,
        type: "log",
        entry,
      };
      self.postMessage(logEvent);
    },
  }).catch((error) => {
    const errorResult: CodeRunnerResult = {
      success: false,
      logs: [
        {
          type: "error",
          args: [
            {
              type: "data",
              value: error.message,
            },
          ],
        },
      ],
      error: error.message,
    };
    return errorResult;
  });

  const resultEvent: CodeWorkerResult = {
    id,
    type: "result",
    result,
  };
  self.postMessage(resultEvent);
};
