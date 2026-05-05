import { SpeechTaskTypes, TagSchemaTypes } from "@/types/data";

export type SpeechTaskValidation = {
  isValid: boolean;
  message?: string;
  errorTitles?: string[];
};

const tagHasValue = (value: string | string[] | undefined): boolean => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim().length > 0;
};

export const validateSpeechTask = (
  task: SpeechTaskTypes,
  schema: TagSchemaTypes
): SpeechTaskValidation => {
  const missing: string[] = [];

  for (const field of schema.recording_level) {
    if (!field.required) continue;
    const value = task.recording_tags?.[field.key];
    if (!tagHasValue(value)) {
      missing.push(`Recording: ${field.label}`);
    }
  }

  task.segments.forEach((segment, i) => {
    for (const field of schema.segment_level) {
      if (!field.required) continue;
      const value = segment.tags?.[field.key];
      if (!tagHasValue(value)) {
        missing.push(`Segment ${i + 1}: ${field.label}`);
      }
    }
  });

  if (missing.length > 0) {
    return {
      isValid: false,
      message: "Please fill all required tags before saving.",
      errorTitles: missing,
    };
  }

  return { isValid: true };
};
