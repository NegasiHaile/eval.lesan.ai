export type TaskEvalErrorTypes = {
  isValid: boolean;
  message?: string;
  errorTitles?: string[];
  errorType?: "rating" | "ranking" | "uniqueRank";
};

export type EvalTypeTypes = {
  name: string;
  value: "mt" | "asr" | "tts";
  full_name: string;
  sample_batch?: string;
};

export type DomainTypes = {
  name: string;
  description: string;
  subdomains?: string[];
};
