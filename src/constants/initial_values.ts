export const userDefaultValues = {
  _id: "",
  username: "",
  password: "",
  email: "",
  fullName: "",
  institution: "",
  role: "user",
  active: true,
};

export const realtimeBatch = {
  dataset_name: "Realtime",
  batch_id: "realtime",
  batch_name: "realtime",
  dataset_domain: "General",
  source_language: {
    iso_name: "English",
    iso_639_1: "en",
    iso_639_3: "eng",
  },
  target_language: {
    iso_name: "Amharic",
    iso_639_1: "am",
    iso_639_3: "amh",
  },
  models: ["Lesan", "Google Translation"],
  annotator_id: null,
  created_by: "",
  created_at: "",
  number_of_tasks: 0,
  annotated_tasks: 0,
  qa_id: null,
};

export const tasksBatchTemplate = {
  batch_id: "",
  dataset_name: "",
  dataset_domain: "",
  batch_name: "",
  source_language: {
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  },
  target_language: {
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  },
  tasks: [
    {
      id: "",
      input: "",
      models: [
        {
          output: "",
          model: "",
          rate: 0,
          rank: 0,
        },
        {
          output: "",
          model: "",
          rate: 0,
          rank: 0,
        },
      ],
    },
  ],
};

export const ttsRealtimeBatch = {
  dataset_name: "Realtime",
  batch_id: "realtime",
  batch_name: "realtime",
  dataset_type: "tts",
  dataset_domain: "General",
  source_language: {
    iso_name: "English",
    iso_639_1: "en",
    iso_639_3: "eng",
  },
  target_language: {
    iso_name: "English",
    iso_639_1: "en",
    iso_639_3: "eng",
  },
  models: ["Lesan"],
  annotator_id: null,
  created_by: "",
  created_at: "",
  number_of_tasks: 0,
  annotated_tasks: 0,
  qa_id: null,
};

export const ttsBatchTemplate = {
  batch_id: "",
  dataset_name: "",
  dataset_domain: "",
  batch_name: "",
  language: {
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  },
  tasks: [
    {
      id: "1",
      input:
        "We believe every human should be able to consume the web's content in their native language.",
      models: [
        { output: "/datasets/sample-tts01-model-A.mp3", model: "A", rate: 0, rank: 0 },
        { output: "/datasets/sample-tts-01-model-B.mp3", model: "B", rate: 0, rank: 0 },
      ],
      reference: "",
      domain: [],
    },
    {
      id: "2",
      input: "አዲስ አበባ የኢትዮጵያ ዋና ከተማ ናት።",
      models: [
        { output: "/datasets/sample-tts01-model-A.mp3", model: "A", rate: 0, rank: 0 },
        { output: "/datasets/sample-tts-01-model-B.mp3", model: "B", rate: 0, rank: 0 },
      ],
      reference: "",
      domain: [],
    },
    {
      id: "3",
      input: "Good morning. Today we will discuss access to healthcare in rural communities.",
      models: [
        { output: "/datasets/sample-tts01-model-A.mp3", model: "A", rate: 0, rank: 0 },
        { output: "/datasets/sample-tts-01-model-B.mp3", model: "B", rate: 0, rank: 0 },
      ],
      reference: "",
      domain: [],
    },
  ],
};

export const asrBatchTemplate = {
  batch_id: "",
  dataset_name: "",
  dataset_domain: "",
  batch_name: "",
  language: {
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  },
  tasks: [
    {
      id: "",
      input: "",
      models: [
        {
          output: "",
          model: "A",
          rate: 0,
          rank: 0,
        },
        {
          output: "",
          model: "B",
          rate: 0,
          rank: 0,
        },
      ],
      human_correction: "",
    },
  ],
};
