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

import {
  VscAdd,
  VscArrowLeft,
  VscClose,
  VscCloudUpload,
  VscInfo,
  VscSave,
} from "react-icons/vsc";
import { date_DDMMYYYY } from "@/helpers/format-date";

import { LanguageTypes } from "@/types/languages";
import DragDropFile from "@/components/inputs/DragDropFile";
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

  const generateFileDetail = (data: ASRBatchTasksTypes | BatchTasksTypes) => {
    const batch_id = generateUniqueId();

    const batche_details = { ...initialBatchDetail };
    batche_details.batch_id = batch_id;

    // MT
    if (data && "source_language" in data && "target_language" in data) {
      batche_details.source_language = data.source_language;
      batche_details.target_language = data.target_language;
    } else if (data && "language" in data) {
      batche_details.source_language = data.language;
      batche_details.target_language = data.language;
    } else {
    }

    batche_details.dataset_type = activeTab.value; // mt, asr, tts
    batche_details.dataset_domain = data.dataset_domain;
    batche_details.batch_name = data.batch_name;
    batche_details.number_of_tasks = data.tasks.length;
    batche_details.created_by = user?.username ?? "";
    batche_details.rating_guideline = data.rating_guideline ?? [];
    batche_details.domains = data.domains ?? [];

    // Extracting models names from models
    const models: string[] = [];
    data.tasks[0].models.map((item: EvalOutputTypes) => {
      models.push(item.model);
    });
    batche_details.models = models;

    // Count the number of Evaluated tasks, incase the batch was downloaded from the Eval system
    const evaluatedTasks = data.tasks.filter(
      (item: EvalTaskTypes) =>
        item.models[0].rate > 0 && item.models[0].rank > 0
    );
    batche_details.annotated_tasks = evaluatedTasks.length;

    setNewBatchDetail({ ...batche_details });
    return batche_details;
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

        if (!res.ok) {
          throw new Error("Failed to save batch to server.");
        }

        setBatchesDetailTable((prev) => [newBatchDetail, ...prev]);
      } catch (error) {
        console.error("API error:", error);
        alert("Error saving data to server. Data is saved locally.");
      }

      // Reset UI state
      // resetUploading();
      setLoading(false);
      setNewBatchDetail(initialBatchDetail);
      setNewBatchTasks(null);
      setShowUploader(false);
      alert("File content saved successfully.");
    } else {
      alert("Data doesnt exist ");
      return [null, null];
    }
  };

  return (
    <div className="w-full p-5 space-y-3">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800">
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
              <VscArrowLeft /> Go to form
            </>
          ) : (
            <>
              <VscInfo className="w-6 h-6" />
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
                onChange={(data) => {
                  // Deep clone tasks to prevent mutation of original data
                  const deepClonedTasks = JSON.parse(
                    JSON.stringify(data.tasks)
                  );
                  const { anonymized_tasks, task_models_shuffles } =
                    shuffleAndAnonymizeModels(deepClonedTasks, 123);

                  // Optional: set state or generate file using updated data
                  setNewBatchTasks({
                    ...data,
                    tasks: anonymized_tasks,
                    task_models_shuffles,
                  });

                  generateFileDetail({
                    ...data,
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
                      <VscClose /> Cancel
                    </>
                  ) : (
                    <>
                      <VscAdd /> Add annotation category
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
                    <VscSave />
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
                <VscCloudUpload className="w-6 h-6" /> Upload task
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default BatchUploaderForm;
