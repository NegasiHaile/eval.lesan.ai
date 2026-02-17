import { EvalTaskTypes } from "@/types/data";
import { LanguageTypes } from "@/types/languages";
import { languages } from "@/constants/languages";

const defaultOutputs = [
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
    title: "B",
  },
  {
    output: "",
    model: "C",
    rate: 0,
    rank: 0,
  },
  {
    output: "",
    model: "D",
    rate: 0,
    rank: 0,
  },
  {
    output: "",
    model: "E",
    rate: 0,
    rank: 0,
    title: "E",
  },
  {
    output: "",
    model: "F",
    rate: 0,
    rank: 0,
  },
];

export const findLanguage = (langCode: string): LanguageTypes => {
  const code = langCode.trim().toLowerCase();

  for (const lang of languages) {
    if (
      code === lang.iso_name.toLowerCase() ||
      code === lang.iso_639_1.toLowerCase() ||
      code === lang.iso_639_3.toLowerCase()
    ) {
      return lang;
    }
  }

  return {
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  };
};

const generate_realtime_task = (
  models: number,
  source_language: string,
  target_language: string
) => {
  const defaultTask = {
    id: "",
    dataset_name: "realtime",
    source_language: findLanguage(source_language ?? "eng"),
    target_language: findLanguage(target_language ?? "amh"),
    input: ``,
    models: defaultOutputs.slice(0, models),
  };

  return defaultTask;
};

export function get_eval_tasks(
  modes: number,
  dataset_name: string,
  source_language: string,
  target_language: string
): EvalTaskTypes[] {
  const datasets = JSON.parse(localStorage.getItem("batches") || "[]");
  // console.log("Available datasets:", datasets);
  if (datasets.length > 0) {
    const datasetFound = datasets.find(
      (ds: { batch_id: string; tasks: EvalTaskTypes[] }) =>
        ds.batch_id.toLowerCase() === dataset_name.toLowerCase()
    );

    // console.log("Dataset found:", datasetFound);
    if (!datasetFound) {
      return [generate_realtime_task(modes, source_language, target_language)];
    }
    return datasetFound?.tasks;
  } else {
    return [generate_realtime_task(modes, source_language, target_language)];
  }
}

export function generate_realtime_asr_batch(
  models: number,
  dataset_name: string,
  language: string
) {
  return {
    batch_id: "",
    dataset_name: dataset_name,
    dataset_domain: "",
    batch_name: dataset_name,
    language: findLanguage(language ?? "eng"),
    tasks: [
      {
        id: "",
        input: "",
        models: defaultOutputs.slice(0, models),
        human_correction: "",
      },
    ],
  };
}
