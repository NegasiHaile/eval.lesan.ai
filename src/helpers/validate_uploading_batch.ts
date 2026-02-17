import { BatchTasksTypes } from "@/types/data";

const keys = {
  mt: {
    topLevel: ["tasks"],
    taskKeys: ["id", "input", "models"],
    modelKeys: ["output", "model", "rate", "rank"],
  },
  asr: {
    topLevel: ["tasks"],
    taskKeys: ["id", "input", "models"],
    modelKeys: ["output", "model", "rate", "rank"],
  },
  tts: {
    topLevel: ["tasks"],
    taskKeys: ["id", "input", "models"],
    modelKeys: ["output", "model", "rate", "rank"],
  },
};

const isPathOrUrl = (value: string): boolean => {
  return /^https?:\/\/|^\/|^[A-Za-z]:\\/.test(value);
};

export const isValidBatchData = (
  type: "mt" | "asr" | "tts" = "mt",
  data: BatchTasksTypes
): { isValid: boolean; message: string } => {
  const { topLevel, taskKeys, modelKeys } = keys[type];

  const groupedMessages: Map<string, number[]> = new Map();
  const miscMessages: string[] = [];

  const groupError = (baseMessage: string, taskIndex: number) => {
    if (!groupedMessages.has(baseMessage)) groupedMessages.set(baseMessage, []);
    groupedMessages.get(baseMessage)!.push(taskIndex);
  };

  // 1. Validate top-level keys
  const missingTopKeys = topLevel.filter((key) => !(key in data));
  if (missingTopKeys.length > 0) {
    miscMessages.push(
      `Missing top-level ${type.toUpperCase()} batch key(s): ${missingTopKeys.join(
        ", "
      )}`
    );
  }

  // 2. Validate tasks
  if (!Array.isArray(data.tasks)) {
    miscMessages.push("`tasks` must be an array.");
  } else if (data.tasks.length < 1) {
    miscMessages.push("Insufficient task, there must be at least one task.");
  } else {
    data.tasks.forEach((task, taskIndex) => {
      const missingTaskKeys = taskKeys.filter((key) => !(key in task));
      if (missingTaskKeys.length > 0) {
        miscMessages.push(
          `Task ${taskIndex} is missing key(s): ${missingTaskKeys.join(", ")}`
        );
      }

      // Input validation
      if (typeof task.input !== "string") {
        miscMessages.push(`Task ${taskIndex} input must be a string.`);
      } else {
        if (type === "asr" && !isPathOrUrl(task.input)) {
          groupError(
            "ASR task input must be a valid URL or file path",
            taskIndex
          );
        } else if (
          (type === "mt" || type === "tts") &&
          isPathOrUrl(task.input)
        ) {
          groupError(
            `${type.toUpperCase()} task input must be plain text`,
            taskIndex
          );
        }
      }

      // Models
      if (!Array.isArray(task.models)) {
        miscMessages.push(
          `Task ${taskIndex} has an invalid or missing 'models' array.`
        );
        return;
      }

      if (task.models.length < 1) {
        groupError("Task must have at least one model", taskIndex);
        return;
      }

      task.models.forEach((model, modelIndex) => {
        const missingModelKeys = modelKeys.filter((key) => !(key in model));
        if (missingModelKeys.length > 0) {
          miscMessages.push(
            `Task ${taskIndex}, model ${modelIndex} is missing key(s): ${missingModelKeys.join(
              ", "
            )}`
          );
          return;
        }

        // Field types
        if (
          typeof model.output !== "string" ||
          typeof model.model !== "string"
        ) {
          miscMessages.push(
            `Task ${taskIndex}, model ${modelIndex} fields 'output' and 'model' must be strings.`
          );
        }

        if (typeof model.rate !== "number" || typeof model.rank !== "number") {
          miscMessages.push(
            `Task ${taskIndex}, model ${modelIndex} fields 'rate' and 'rank' must be numbers.`
          );
        }

        // Output format
        if (typeof model.output === "string") {
          if (type === "tts" && !isPathOrUrl(model.output)) {
            miscMessages.push(
              `TTS task ${taskIndex}, model ${modelIndex} output must be a valid URL or file path.`
            );
          } else if (
            (type === "mt" || type === "asr") &&
            isPathOrUrl(model.output)
          ) {
            miscMessages.push(
              `${type.toUpperCase()} task ${taskIndex}, model ${modelIndex} output must be plain text, not a URL or file path.`
            );
          }
        }
      });
    });
  }

  // Format grouped messages
  const finalGroupedMessages: string[] = [];
  for (const [msg, indexes] of groupedMessages.entries()) {
    finalGroupedMessages.push(`${msg} at task indexes: ${indexes.join(", ")}.`);
  }

  const allMessages = [...finalGroupedMessages, ...miscMessages];

  return {
    isValid: allMessages.length === 0,
    message:
      allMessages.length === 0
        ? "Batch data is valid."
        : `Validation failed:\n- ${allMessages.join("\n- ")}`,
  };
};
