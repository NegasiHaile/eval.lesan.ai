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
