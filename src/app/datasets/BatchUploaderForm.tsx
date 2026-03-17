import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import TextInput from "@/components/inputs/TextInput";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  BatchTasksTypes,
  EvalTaskTypes,
  guidelineTypes,
  EvalOutputTypes,
} from "@/types/data";
import { DomainTypes, EvalTypeTypes } from "@/types/others";
import { languages } from "@/constants/iso1-iso3-languages";
import SelectOption from "@/components/inputs/SelectOption";
import Button from "@/components/utils/Button";

import TextareaInput from "@/components/inputs/TextareaInput";
import DomainsList from "@/components/DomainsList";
import DatasetUploadGuidelines from "./DatasetUploadGuidelines";
import Modal from "@/components/utils/Modal";

import {
  ArrowLeft,
  CloudUpload,
  Info,
  Plus,
  Save,
  X,
} from "lucide-react";
import { date_DDMMYYYY } from "@/helpers/format-date";

import { LanguageTypes } from "@/types/languages";
import DragDropFile, { type BatchData } from "@/components/inputs/DragDropFile";
import { UserTypes } from "@/types/user";

import { userDefaultValues } from "@/constants/initial_values";
import { shuffleAndAnonymizeModels } from "@/helpers/task_models_shuffler";

type PropsType = {
  setBatchesDetailTable: Dispatch<SetStateAction<BatchDetailTypes[]>>;
  activeTab: EvalTypeTypes;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setShowUploader: Dispatch<SetStateAction<boolean>>;
};

type categoryType = {
  name: string;
  description: string;
  subdomains: string[] | string;
};

const initialBatchDetail = {
  batch_id: "T001",
  batch_name: "",
  dataset_type: "",
  dataset_domain: "",
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
  models: [] as string[],
  annotator_id: null,
  created_by: "",
  created_at: `${date_DDMMYYYY(new Date())}`,
  number_of_tasks: 0,
  annotated_tasks: 0,
  qa_id: null,
  rating_guideline: [] as guidelineTypes[],
  domains: [] as DomainTypes[],
};

const categoryItem: categoryType = {
  name: "",
  description: "",
  subdomains: [],
};

// TODO: tasks_models_suffle
// // "tasks_models_suffle": [["google", "lesan"], ["lesan", "google"], ["lesan", "google"], ["google", "lesan"]],

const BatchUploaderForm = ({
  setBatchesDetailTable,
  activeTab,
  loading,
  setLoading,
  setShowUploader,
}: PropsType) => {
  const [user, setUser] = useState<UserTypes>({ ...userDefaultValues });
  const [addingCategory, setAddingCategory] = useState<boolean>(false);
  const [category, setCategory] = useState<categoryType>(categoryItem);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [feedback, setFeedback] = useState<{
    title: string;
    message: string;
    variant: "info" | "success" | "error";
    closeUploaderOnClose?: boolean;
  } | null>(null);

  const showFeedback = (
    title: string,
    message: string,
    variant: "info" | "success" | "error" = "info",
    closeUploaderOnClose = false
  ) => {
    setFeedback({ title, message, variant, closeUploaderOnClose });
  };

  const setFeedbackOpen: Dispatch<SetStateAction<boolean>> = (next) => {
    const open = typeof next === "function" ? next(!!feedback) : next;
    if (open) return;
    const shouldClose = feedback?.closeUploaderOnClose;
    setFeedback(null);
    if (shouldClose) setShowUploader(false);
  };

  const [newBatchDetail, setNewBatchDetail] =
    useState<BatchDetailTypes>(initialBatchDetail);
  const [newBatchTasks, setNewBatchTasks] = useState<
    ASRBatchTasksTypes | BatchTasksTypes | null
  >();

  // Load saved file content from localStorage on mount
  useEffect(() => {
    const usr = JSON.parse(localStorage.getItem("user") || JSON.stringify(""));
    setUser(usr);
  }, []);

  const removeCategoryByIndex = (nameToRemove: string) => {
    setNewBatchDetail((prev) => ({
      ...prev,
      domains: prev.domains?.filter((item) => item.name !== nameToRemove),
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name;
    const value = e.target.value;

    setNewBatchDetail((prev) => ({ ...prev, [name]: value }));
  };

  const generateUniqueId = (): string => {
    return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  };

  /** Uploaded batch JSON may include optional creator/annotator/reviewer fields. */
  type BatchDataWithMeta = (ASRBatchTasksTypes | BatchTasksTypes) & {
    created_by?: string;
    annotator_id?: string | null;
    qa_id?: string | null;
  };

  /** Returns batch detail from parsed data (no state update). Used for single and multi-file save. */
  const getBatchDetailFromData = (
    data: ASRBatchTasksTypes | BatchTasksTypes
  ): BatchDetailTypes => {
    const batch_id = generateUniqueId();
    const batche_details: BatchDetailTypes = { ...initialBatchDetail };
    batche_details.batch_id = batch_id;
    const withMeta = data as BatchDataWithMeta;

    if (data && "source_language" in data && "target_language" in data) {
      batche_details.source_language = data.source_language;
      batche_details.target_language = data.target_language;
    } else if (data && "language" in data) {
      batche_details.source_language = data.language;
      batche_details.target_language = data.language;
    }

    batche_details.dataset_type = activeTab.value;
    batche_details.dataset_domain = data.dataset_domain;
    batche_details.batch_name = data.batch_name;
    batche_details.number_of_tasks = data.tasks.length;
    batche_details.created_by =
      (typeof withMeta.created_by === "string" && withMeta.created_by.trim())
        ? withMeta.created_by.trim()
        : (user?.username ?? "");
    batche_details.annotator_id =
      typeof withMeta.annotator_id === "string" && withMeta.annotator_id.trim()
        ? withMeta.annotator_id.trim()
        : null;
    batche_details.qa_id =
      typeof withMeta.qa_id === "string" && withMeta.qa_id.trim()
        ? withMeta.qa_id.trim()
        : null;
    batche_details.rating_guideline = data.rating_guideline ?? [];
    batche_details.domains = data.domains ?? [];

    const models: string[] = [];
    data.tasks[0].models.map((item: EvalOutputTypes) => {
      models.push(item.model);
    });
    batche_details.models = models;

    const evaluatedTasks = data.tasks.filter(
      (item: EvalTaskTypes) =>
        item.models[0].rate > 0 && item.models[0].rank > 0
    );
    batche_details.annotated_tasks = evaluatedTasks.length;

    return batche_details;
  };

  const generateFileDetail = (data: ASRBatchTasksTypes | BatchTasksTypes) => {
    const batche_details = getBatchDetailFromData(data);
    setNewBatchDetail({ ...batche_details });
    return batche_details;
  };

  /** Save one batch to the server using existing implementation. Used for multi-file upload. */
  const saveOneBatch = async (
    data: ASRBatchTasksTypes | BatchTasksTypes
  ): Promise<BatchDetailTypes | null> => {
    const deepClonedTasks = JSON.parse(JSON.stringify(data.tasks));
    const { anonymized_tasks, task_models_shuffles } =
      shuffleAndAnonymizeModels(deepClonedTasks, 123);
    const payload = {
      ...data,
      tasks: anonymized_tasks,
      task_models_shuffles,
    };
    const detail = getBatchDetailFromData(payload);

    let tasks_batch: ASRBatchTasksTypes | BatchTasksTypes = {
      ...payload,
      batch_id: detail.batch_id,
      dataset_name: detail.batch_name,
      dataset_domain: detail.dataset_domain,
      batch_name: detail.batch_name,
    };
    delete tasks_batch.domains;
    delete tasks_batch.rating_guideline;

    if (activeTab.value.toLowerCase() === "mt") {
      tasks_batch = {
        ...tasks_batch,
        source_language: detail.source_language,
        target_language: detail.target_language,
      };
      if ("language" in tasks_batch) delete tasks_batch.language;
    } else {
      tasks_batch = {
        ...tasks_batch,
        language: detail.source_language,
      };
      if ("source_language" in tasks_batch) delete tasks_batch.source_language;
      if ("target_language" in tasks_batch) delete tasks_batch.target_language;
    }

    const res = await fetch(`/api/batches/${activeTab.value}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchDetail: detail,
        batchTask: tasks_batch,
      }),
    });

    if (res.status === 409) {
      const body = await res.json();
      throw new Error(body.message ?? "Conflict");
    }
    if (!res.ok) throw new Error("Failed to save batch to server.");

    return detail;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newBatchTasks) {
      setLoading(true);
      let tasks_batch: ASRBatchTasksTypes | BatchTasksTypes = {
        ...newBatchTasks,
        batch_id: newBatchDetail.batch_id,
        dataset_name: newBatchDetail.batch_name,
        dataset_domain: newBatchDetail.dataset_domain,
        batch_name: newBatchDetail.batch_name,
      };
      delete tasks_batch.domains;
      delete tasks_batch.rating_guideline;

      if (activeTab.value.toLowerCase() === "mt") {
        // MT
        tasks_batch = {
          ...tasks_batch,
          source_language: newBatchDetail.source_language,
          target_language: newBatchDetail.target_language,
        };

        if ("language" in tasks_batch) delete tasks_batch.language;
      } else {
        // ASR and TTS
        tasks_batch = {
          ...tasks_batch,
          language: newBatchDetail.source_language,
        };
        if ("source_language" in tasks_batch)
          delete tasks_batch.source_language;
        if ("target_language" in tasks_batch)
          delete tasks_batch.target_language;
      }

      // console.log("New batch detail;", newBatchDetail);
      // console.log("New batch tasks:", tasks_batch);

      try {
        const res = await fetch(`/api/batches/${activeTab.value}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batchDetail: newBatchDetail,
            batchTask: tasks_batch,
          }),
        });

        if (res.status === 409) {
          const data = await res.json();
          showFeedback("Upload conflict", data.message, "error");
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to save batch to server.");
        }

        setBatchesDetailTable((prev) => [newBatchDetail, ...prev]);
      } catch (error) {
        console.error("API error:", error);
        showFeedback(
          "Upload failed",
          "Error saving data to server. Data is saved locally.",
          "error"
        );
      }

      // Reset UI state
      // resetUploading();
      setLoading(false);
      setNewBatchDetail(initialBatchDetail);
      setNewBatchTasks(null);
      showFeedback(
        "Upload successful",
        "File content saved successfully.",
        "success",
        true
      );
    } else {
      showFeedback("No data", "Data doesnt exist.", "error");
      return [null, null];
    }
  };

  return (
    <div className="w-full p-5 space-y-3">
      <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xl font-mono">
          Create <span className="uppercase font-bold">{activeTab.name}</span>{" "}
          task
        </p>
        <Button
          size="sm"
          className="!w-fit !font-mono"
          variant="primary"
          minimal
          onClick={() => setShowGuidelines(!showGuidelines)}
        >
          {showGuidelines ? (
            <>
              <ArrowLeft className="size-4 shrink-0" /> Go to form
            </>
          ) : (
            <>
              <Info className="size-6 shrink-0" />
              Uploading guideline
            </>
          )}
        </Button>
      </div>

      {showGuidelines ? (
        <div style={{ maxHeight: "70vh" }} className="overflow-y-auto">
          <DatasetUploadGuidelines
            activeTab={activeTab.value.toUpperCase() as "MT" | "ASR"}
          />
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSave}
            className="w-full flex flex-wrap md:grid md:grid-cols-2 gap-4"
          >
            <div className="w-full flex flex-col md:col-span-2 items-end">
              <DragDropFile
                activeTab={activeTab}
                loading={loading}
                onChange={async (data) => {
                  const items: BatchData[] = Array.isArray(data) ? data : [data];

                  if (items.length > 1) {
                    setLoading(true);
                    const saved: BatchDetailTypes[] = [];
                    const errors: string[] = [];
                    for (let i = 0; i < items.length; i++) {
                      try {
                        const detail = await saveOneBatch(items[i]);
                        if (detail) {
                          saved.push(detail);
                          setBatchesDetailTable((prev) => [detail, ...prev]);
                        }
                      } catch (err) {
                        errors.push(
                          `${items[i]?.batch_name ?? `File ${i + 1}`}: ${err instanceof Error ? err.message : "Failed"}`
                        );
                      }
                    }
                    setLoading(false);
                    if (saved.length > 0) {
                      showFeedback(
                        errors.length > 0
                          ? "Upload partially successful"
                          : "Upload successful",
                        errors.length > 0
                          ? `${saved.length} batch(es) uploaded. ${errors.length} failed: ${errors.join("; ")}`
                          : `${saved.length} batch(es) uploaded successfully.`,
                        errors.length > 0 ? "error" : "success",
                        true
                      );
                    } else if (errors.length > 0) {
                      showFeedback(
                        "Upload failed",
                        `Upload failed: ${errors.join("; ")}`,
                        "error",
                        true
                      );
                    }
                    return;
                  }

                  const single = items[0];
                  const deepClonedTasks = JSON.parse(
                    JSON.stringify(single.tasks)
                  );
                  const { anonymized_tasks, task_models_shuffles } =
                    shuffleAndAnonymizeModels(deepClonedTasks, 123);

                  setNewBatchTasks({
                    ...single,
                    tasks: anonymized_tasks,
                    task_models_shuffles,
                  });

                  generateFileDetail({
                    ...single,
                    tasks: anonymized_tasks,
                    task_models_shuffles,
                  });
                }}
                required={true}
              />
            </div>

            <TextInput
              type="text"
              placeholder="Enter batch name"
              name="batch_name"
              value={newBatchDetail.batch_name}
              required={true}
              onChange={(e) => handleInputChange(e)}
            />
            <TextInput
              type="text"
              placeholder="Enter dataset domain"
              name="dataset_domain"
              value={newBatchDetail.dataset_domain}
              required={true}
              onChange={(e) => handleInputChange(e)}
            />

            <SelectOption
              id="source_language"
              variant="outlined"
              name="source_language"
              value={newBatchDetail.source_language.iso_639_3}
              options={languages}
              onChange={(selectedSrcLang: LanguageTypes) => {
                setNewBatchDetail((prev) => ({
                  ...prev,
                  source_language: { ...selectedSrcLang },
                }));
              }}
              disabled={false}
              allowAddLanguage={true}
              placeholder={`Select ${
                activeTab.value.toLowerCase() === "mt"
                  ? "source-language"
                  : "language"
              }`}
            />

            {activeTab.value === "mt" && (
              <SelectOption
                id="target_language"
                variant="outlined"
                name="target_language"
                value={newBatchDetail.target_language.iso_639_3}
                options={languages}
                onChange={(selectedTrgtLang: LanguageTypes) => {
                  setNewBatchDetail((prev) => ({
                    ...prev,
                    target_language: { ...selectedTrgtLang },
                  }));
                }}
                disabled={false}
                allowAddLanguage={true}
                placeholder="Select target-language"
              />
            )}

            <div className="w-full md:col-span-2 flex items-center justify-end">
              <div className="w-fit flex items-center space-x-2 font-mono">
                <Button
                  size="sm"
                  className="!w-fit"
                  type="button"
                  variant={addingCategory ? "danger" : "primary"}
                  minimal
                  onClick={() => setAddingCategory(!addingCategory)}
                >
                  {addingCategory ? (
                    <>
                      <X className="size-4 shrink-0" /> Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 shrink-0" /> Add annotation category
                    </>
                  )}
                </Button>

                {addingCategory && (
                  <Button
                    type="button"
                    size="sm"
                    className="!w-fit"
                    variant={"success"}
                    minimal
                    onClick={() => {
                      if (!category.name) return;
                      const ctgry = {
                        ...category,
                        subdomains: (category.subdomains as string)
                          ?.split(",")
                          .map((item: string) => item.trim())
                          .filter((item: string) => item !== ""), // ✅ remove empty entries
                      };
                      setNewBatchDetail((prev) => ({
                        ...prev,
                        domains: [...(prev.domains ?? []), ctgry],
                      }));
                      setCategory(categoryItem);
                      setAddingCategory(false);
                    }}
                  >
                    <Save className="size-4 shrink-0" />
                    Save
                  </Button>
                )}
              </div>
            </div>

            {addingCategory && (
              <>
                <div className="w-full md:col-span-2 ">
                  <TextInput
                    type="text"
                    placeholder="Enter category name"
                    name="name"
                    value={category.name}
                    required={true}
                    onChange={(e) =>
                      setCategory((prev) => ({
                        ...prev,
                        [e.target.name]: e.target.value,
                      }))
                    }
                  />
                </div>

                <TextareaInput
                  name="subdomains"
                  value={category.subdomains as string}
                  required={true}
                  rows={3}
                  size="sm"
                  placeholder={`Comma separated ${category.name} sub-categories`}
                  onChange={(e) =>
                    setCategory((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />

                <TextareaInput
                  name="description"
                  value={category.description}
                  rows={3}
                  size="sm"
                  placeholder="Description of the category"
                  onChange={(e) =>
                    setCategory((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />
              </>
            )}

            <div className="w-full md:col-span-2 space-y-2">
              {newBatchDetail.domains && newBatchDetail.domains.length > 0 && (
                <DomainsList
                  domains={newBatchDetail.domains.map((item) => {
                    return {
                      ...item,
                      subdomains: item.subdomains as string[],
                    };
                  })}
                  selectedDomains={[]}
                  toggleDomainSelection={() => {}}
                  onRemove={(name) => removeCategoryByIndex(name)}
                  onEdit={(name) => {
                    const categ =
                      newBatchDetail.domains &&
                      newBatchDetail.domains.find((item) => item.name === name);
                    if (categ) {
                      setCategory({
                        ...categ,
                        subdomains: (categ.subdomains as string[]).join(", "),
                      });
                    }
                    removeCategoryByIndex(name);
                    setAddingCategory(true);
                  }}
                />
              )}
            </div>
            <div className="w-full md:col-span-2 flex items-end mt-10">
              <Button outline type="submit" loading={loading}>
                <CloudUpload className="size-6 shrink-0" /> Upload task
              </Button>
            </div>
          </form>
        </>
      )}
      {feedback && (
        <Modal
          isOpen={!!feedback}
          setIsOpen={setFeedbackOpen}
          className="!max-w-xs"
        >
          <div className="p-4 space-y-3">
            <h3 className="text-base font-semibold font-mono">{feedback.title}</h3>
            <p
              className={`text-sm ${
                feedback.variant === "error"
                  ? "text-red-600 dark:text-red-400"
                  : feedback.variant === "success"
                  ? "text-green-700 dark:text-green-400"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {feedback.message}
            </p>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant={feedback.variant === "error" ? "danger" : "primary"}
                onClick={() => setFeedbackOpen(false)}
              >
                OK
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BatchUploaderForm;
