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
  /** Contributor / assignee email (used in files metadata export). Falls back to annotator_id when not set. */
  assigned_to?: string | null;
  created_by: string;
  created_at: string;
  number_of_tasks: number;
  /** Tasks with rate and rank set (evaluated). */
  annotated_tasks: number | string;
  /** Tasks that have a reviewer_comment (reviewed by QC). Optional; populated when available from backend. */
  reviewed_tasks?: number | string;
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
