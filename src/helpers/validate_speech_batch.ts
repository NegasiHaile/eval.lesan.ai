import { SpeechBatchTasksTypes, TagFieldTypes } from "@/types/data";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLanguageObject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.iso_639_3 === "string" || typeof o.iso_name === "string";
}

function isUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https?:\/\/|^\/|^[A-Za-z]:\\/.test(value.trim())
  );
}

function isValidTagField(value: unknown): value is TagFieldTypes {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  if (!isNonEmptyString(f.key) || !isNonEmptyString(f.label)) return false;
  if (!Array.isArray(f.options) || f.options.length === 0) return false;
  if (!f.options.every((opt) => typeof opt === "string")) return false;
  if (f.required !== undefined && typeof f.required !== "boolean") return false;
  if (f.multi !== undefined && typeof f.multi !== "boolean") return false;
  return true;
}

export type ValidateBatchOptions = {
  requireMetadata?: boolean;
};

export const isValidSpeechBatchData = (
  data: SpeechBatchTasksTypes,
  options: ValidateBatchOptions = {}
): { isValid: boolean; message: string } => {
  const { requireMetadata = false } = options;
  const messages: string[] = [];

  if (requireMetadata) {
    if (!isNonEmptyString((data as Record<string, unknown>).batch_name as string)) {
      messages.push("`batch_name` is required and must be a non-empty string.");
    }
    if (
      !isNonEmptyString(
        (data as Record<string, unknown>).dataset_domain as string
      )
    ) {
      messages.push(
        "`dataset_domain` is required and must be a non-empty string."
      );
    }
    if (!isLanguageObject((data as Record<string, unknown>).language)) {
      messages.push(
        "`language` is required and must be an object with at least `iso_639_3` or `iso_name`."
      );
    }
  }

  // tag_schema validation
  const schema = (data as Record<string, unknown>).tag_schema as
    | Record<string, unknown>
    | undefined;
  if (!schema || typeof schema !== "object") {
    messages.push("`tag_schema` is required.");
  } else {
    const recordingLevel = schema.recording_level;
    const segmentLevel = schema.segment_level;
    if (!Array.isArray(recordingLevel)) {
      messages.push("`tag_schema.recording_level` must be an array.");
    } else {
      recordingLevel.forEach((field, i) => {
        if (!isValidTagField(field)) {
          messages.push(
            `tag_schema.recording_level[${i}] must have key, label, and non-empty options[].`
          );
        }
      });
    }
    if (!Array.isArray(segmentLevel)) {
      messages.push("`tag_schema.segment_level` must be an array.");
    } else {
      segmentLevel.forEach((field, i) => {
        if (!isValidTagField(field)) {
          messages.push(
            `tag_schema.segment_level[${i}] must have key, label, and non-empty options[].`
          );
        }
      });
    }
  }

  // tasks validation
  if (!Array.isArray(data.tasks)) {
    messages.push("`tasks` must be an array.");
  } else if (data.tasks.length < 1) {
    messages.push("There must be at least one task.");
  } else {
    data.tasks.forEach((task, taskIndex) => {
      if (task.id === undefined || task.id === null) {
        messages.push(`Task ${taskIndex} is missing 'id'.`);
      }
      if (!isUrl(task.video_url)) {
        messages.push(
          `Task ${taskIndex} 'video_url' must be a valid URL or path.`
        );
      }
      if (!Array.isArray(task.segments)) {
        messages.push(`Task ${taskIndex} 'segments' must be an array.`);
        return;
      }
      if (task.segments.length === 0) {
        messages.push(`Task ${taskIndex} must have at least one segment.`);
        return;
      }
      task.segments.forEach((segment, segIndex) => {
        if (segment.id === undefined || segment.id === null) {
          messages.push(
            `Task ${taskIndex}, segment ${segIndex} is missing 'id'.`
          );
        }
        if (!isUrl(segment.audio_url)) {
          messages.push(
            `Task ${taskIndex}, segment ${segIndex} 'audio_url' must be a valid URL or path.`
          );
        }
        if (typeof segment.transcript !== "string") {
          messages.push(
            `Task ${taskIndex}, segment ${segIndex} 'transcript' must be a string.`
          );
        }
        if (
          segment.start_time !== undefined &&
          typeof segment.start_time !== "number"
        ) {
          messages.push(
            `Task ${taskIndex}, segment ${segIndex} 'start_time' must be a number.`
          );
        }
      });
    });
  }

  return {
    isValid: messages.length === 0,
    message:
      messages.length === 0
        ? "Batch data is valid."
        : `Validation failed:\n- ${messages.join("\n- ")}`,
  };
};
