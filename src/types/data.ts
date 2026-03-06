import { LanguageTypes } from "./languages";
import { DomainTypes } from "./others";

export type EvalOutputTypes = {
  output: string;
  model: string;
  rate: number;
  rank: number;
};

export type EvalTaskTypes = {
  id: string | number;
  input: string;
  models: EvalOutputTypes[];
  reference?: string;
  domain?: string[];
  reviewer_comment?: string;
  started_at?: string;
  completed_at?: string;
  active_duration_ms?: number;
};

export type guidelineTypes = {
  scale: number;
  value: string;
  description: string;
  example?: string[] | [];
};

export type BatchTasksTypes = {
  batch_id?: string;
  dataset_name: string;
  dataset_domain: string;
  batch_name: string;
  source_language: LanguageTypes;
  target_language: LanguageTypes;
  tasks: EvalTaskTypes[];
  task_models_shuffles?: Record<string, Record<string, string>>;
  rating_guideline?: guidelineTypes[] | [];
  domains?: DomainTypes[] | [];
};

export type ASRBatchTasksTypes = {
  batch_id?: string;
  dataset_name: string;
  dataset_domain: string;
  batch_name: string;
  language: LanguageTypes;
  tasks: EvalTaskTypes[];
  task_models_shuffles?: Record<string, Record<string, string>>;
  rating_guideline?: guidelineTypes[] | [];
  domains?: DomainTypes[] | [];
};

export type BatchDetailTypes = {
  batch_id: string;
  batch_name: string;
  dataset_type?: string;
  dataset_domain: string;
  source_language: LanguageTypes;
  target_language: LanguageTypes;
  models: string[] | [];
  annotator_id: string | null;
  created_by: string;
  created_at: string;
  number_of_tasks: number;
  annotated_tasks: number | string;
  qa_id: string | null;
  rating_guideline?: guidelineTypes[] | [];
  domains?: DomainTypes[] | [];
};

// export type TranslationTaskTypes = {
//   id: string | number;
//   source_language: string;
//   target_language: string;
//   dataset_name: string;
//   input: string;
//   models: EvalOutputTypes[];
//   annotator_id?: string;
//   qa_id?: string;
//   generated_at?: string;
//   annotated_at?: string;
// };
