import { SpeechBatchTasksTypes, TagSchemaTypes } from "@/types/data";

export const defaultSpeechTagSchema: TagSchemaTypes = {
  recording_level: [
    {
      key: "topic",
      label: "Topic",
      options: ["Politics", "Health", "Sport", "Culture", "Tech", "Other"],
      required: true,
    },
  ],
  segment_level: [
    {
      key: "gender",
      label: "Gender",
      options: ["male", "female", "unknown"],
      required: true,
    },
    {
      key: "dialect",
      label: "Dialect",
      options: ["Gondar", "Wello", "Showa", "Other"],
    },
    {
      key: "domain",
      label: "Domain",
      options: ["formal", "casual"],
    },
  ],
};

export const speechBatchTemplate: SpeechBatchTasksTypes = {
  batch_id: "",
  dataset_name: "",
  dataset_domain: "",
  batch_name: "",
  language: {
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  },
  tag_schema: defaultSpeechTagSchema,
  tasks: [],
};
