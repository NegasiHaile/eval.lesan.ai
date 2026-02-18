"use client";

import { useEffect, useState } from "react";

import AudioCard from "@/components/inputs/AudioCard";
import SelectOption from "@/components/inputs/SelectOption";
import TranslationOutputArea from "@/components/inputs/TranslationOutputArea";
import { languages } from "@/constants/languages";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  EvalTaskTypes,
} from "@/types/data";
import ToggleButton from "@/components/ToggleButton";
import Container from "@/components/utils/Container";
import { useUser } from "@/context/UserContext";
import SelectTransparent from "@/components/inputs/SelectTransparent";
import { realtimeBatch, asrBatchTemplate } from "@/constants/initial_values";
import { generate_realtime_asr_batch } from "@/scripts/generat_eval_data";
import { asrModels } from "@/constants/models";
import { validateEvaluationTask } from "@/helpers/validate_evaluation_task";
import { TaskEvalErrorTypes } from "@/types/others";
import Button from "@/components/utils/Button";
import DomainsList from "@/components/DomainsList";
import { Minus, Plus } from "lucide-react";

export default function ASR() {
  const { user } = useUser();
  const [outputTextareaHeight, setOutputTextareaHeight] =
    useState<string>("md:min-h-25");

  // const [batchesDetails, setBatchesDetails] = useState<BatchDetailTypes[]>([
  //   asrBatchTemplate,
  // ]);
  const [batchesDetails, setBatchesDetails] = useState<BatchDetailTypes[]>([
    realtimeBatch,
  ]);

  const [selectedBatchDetail, setSelectedBatchDetail] =
    useState<BatchDetailTypes>(realtimeBatch);
  const [batchTasks, setBatchTasks] = useState<EvalTaskTypes[]>([]);
  const [evalTask, setEvalTask] = useState<EvalTaskTypes | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);

  const [modelsToEval, setModelsToEval] = useState<number>(2);

  const [error, setError] = useState<TaskEvalErrorTypes | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [showReference, setShowReference] = useState(false);

  const IsRealtime = () => {
    return selectedBatchDetail?.batch_name?.toLowerCase().includes("realtime");
  };

  const handleResetEvalTask = (num_models: number) => {
    // setError(null);
    const rtBatch: ASRBatchTasksTypes = generate_realtime_asr_batch(
      num_models,
      "realtime",
      "eng"
    );

    setEvalTask({ ...rtBatch.tasks[0] });
    setBatchTasks([...rtBatch.tasks]);
  };

  const RankTranscription = (fromIndex: number, toIndex: number) => {
    setEvalTask((prev) => {
      if (!prev) return prev; // Add null check

      const updatedOutputs = [...prev.models];
      const [movedItem] = updatedOutputs.splice(fromIndex, 1);
      updatedOutputs.splice(toIndex, 0, movedItem);

      const reRankedOutputs = updatedOutputs.map((output, index) => ({
        ...output,
        rank: index + 1,
      }));

      return {
        ...prev,
        models: reRankedOutputs,
      };
    });
  };

  const RateTranscription = (index: number, rating: number) => {
    setEvalTask((prev) => {
      if (!prev) return prev;

      const updatedOutputs = prev.models.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            rate: rating,
            rank: i + 1, // Update rank to reflect current index + 1 as rank is 0 by default
          };
        }
        return item;
      });

      return {
        ...prev,
        models: updatedOutputs,
      };
    });
  };

  const FetchBatchTasks = async (batch_detail: BatchDetailTypes) => {
    const res = await fetch(`/api/batches/asr/${batch_detail.batch_id}`);
    if (!res.ok) {
      throw new Error("Failed to fetch batch data from server.");
    }

    const batch = await res.json();

    if (batch) return batch;

    return asrBatchTemplate;
  };

  const handleSelectedBatchUpdate = async (batch: BatchDetailTypes) => {
    // Reset existing states first
    handleResetEvalTask(2);
    setCurrentTaskIndex(0);

    // IF realtime, generate an empty task
    if (batch.batch_name.toLowerCase().includes("realtime")) {
      handleResetEvalTask(modelsToEval);
      // handleResetEvalTask(3);
    } else {
      const this_batchTasks = await FetchBatchTasks(batch);

      if (this_batchTasks?.tasks.length > 0) {
        setEvalTask({ ...this_batchTasks.tasks[0] });
        setBatchTasks([...this_batchTasks.tasks]);
        localStorage.setItem(
          "asr_active_batch",
          JSON.stringify(this_batchTasks)
        );
      } else {
        handleResetEvalTask(modelsToEval);
        // handleResetEvalTask(3);
      }
    }
  };

  const handlePreviousEvaluation = () => {
    if (currentTaskIndex > 0) {
      setError(null); // Clear any previous errors
      setCurrentTaskIndex((prev) => prev - 1);
      const previousTask = batchTasks[currentTaskIndex - 1];
      setEvalTask(previousTask);
    } else {
      alert("You are already at the first task!");
    }
  };

  const isThereChangeInActiveTask = () => {
    const storedBatch = JSON.parse(
      localStorage.getItem("asr_active_batch") || "[]"
    );

    const matchingTask = storedBatch?.tasks?.find(
      (task: EvalTaskTypes) => task.id === evalTask?.id
    );
    if (!matchingTask) return true; // No match means it should be updated

    // Deep compare using JSON.stringify (shallow differences will be missed otherwise)
    return JSON.stringify(evalTask) !== JSON.stringify(matchingTask);
  };

  const updateBatchDetail = async (batchDetail: BatchDetailTypes) => {
    await fetch(`/api/batches-details/${selectedBatchDetail.batch_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batchDetail), // full updated batch object including all fields
    });
    setSelectedBatchDetail({ ...batchDetail });
    setBatchesDetails((prev: BatchDetailTypes[]) =>
      prev.map((batch) =>
        batch.batch_id === batchDetail.batch_id ? batchDetail : batch
      )
    );
  };

  const handleSaveTaskChanges = async () => {
    if (!evalTask) return null;
    await fetch(
      `/api/batches/${selectedBatchDetail.dataset_type}/${selectedBatchDetail.batch_id}/tasks/${evalTask.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(evalTask),
      }
    );
  };

  const handleSubmitEvaluation = async () => {
    if (!evalTask) return null;

    // STEP 2. Validate the evaluation task
    const taskValidation = validateEvaluationTask(evalTask);
    setError(taskValidation);
    if (!taskValidation.isValid) return null;

    // STEP 3. Check if the task is REALTIME or BATCH EVALUATION
    if (!selectedBatchDetail.batch_name.toLowerCase().includes("realtime")) {
      const updatedTasks: EvalTaskTypes[] = [...batchTasks];
      updatedTasks[currentTaskIndex] = {
        ...evalTask,
        reference: evalTask.reference?.trim(),
      }; // update specific index

      // STEP 4. Update the state with the updated task
      setBatchTasks(updatedTasks);

      setCurrentTaskIndex((prev) => prev + 1);

      // STEP 5. Save the updated task into database if there is a change only
      if (isThereChangeInActiveTask()) {
        handleSaveTaskChanges();

        // Count the number of Evaluated tasks
        const evaluatedTasks = updatedTasks.filter(
          (item) => item.models[0].rate > 0 && item.models[0].rank > 0
        );
        updateBatchDetail({
          ...selectedBatchDetail,
          annotated_tasks: evaluatedTasks.length,
        });

        localStorage.setItem(
          "asr_active_batch",
          JSON.stringify({ ...selectedBatchDetail, tasks: updatedTasks })
        );
      }

      if (currentTaskIndex + 1 < batchTasks.length) {
        const nextTask = batchTasks[currentTaskIndex + 1];
        setEvalTask(nextTask);
      } else {
        setCurrentTaskIndex(0);
        setEvalTask(null);
        setSelectedBatchDetail(realtimeBatch);
        handleResetEvalTask(2);
        localStorage.removeItem("asr_active_batch");
        alert(
          `End of <${selectedBatchDetail.batch_name}> ASR evaluation tasks!`
        );

        return;
      }
    } else {
      if (evalTask?.input) {
        alert(
          "Realtime transcription is coming soon. For now, this is only for dataset evaluation."
        );
        handleResetEvalTask(2);
      }
    }
  };

  useEffect(() => {
    if (evalTask?.models.length ?? 1 <= 2) {
      setOutputTextareaHeight(`md:min-h-25`);
    } else if (evalTask?.models.length === 3) {
      setOutputTextareaHeight(`md:min-h-19`);
    } else {
      setOutputTextareaHeight("md:min-h-12");
    }
  }, [evalTask]);

  useEffect(() => {
    const fetchASRBatchDetails = async () => {
      try {
        if (user?.username) {
          // STEP 1. GET all asr batches details that belongs to the loggedin user
          const res = await fetch(
            `/api/batches-details?dataset_type=asr&username=${user.username}`
          );
          if (!res.ok) throw new Error("Failed to fetch batch details");
          const data: BatchDetailTypes[] = await res.json();

          if (data.length > 0) {
            setBatchesDetails((prev) => [...data, ...prev]);

            // STEP 2. Check if there is already a batch task stored in localstorage
            const active_batch =
              localStorage.getItem("asr_active_batch") || null;
            if (active_batch) {
              const batch_json = JSON.parse(active_batch) as ASRBatchTasksTypes;
              setEvalTask({ ...batch_json.tasks[0] });
              setBatchTasks([...batch_json.tasks]);

              const existingSelectedBatch = data.find(
                (item) => item.batch_id === batch_json.batch_id
              );

              if (existingSelectedBatch)
                setSelectedBatchDetail(existingSelectedBatch);

              return;
            }
            console.log("HERE");

            // STEP 3. Fetch all the data of the first batch in the detials as a default batch
            const this_batchTasks = await FetchBatchTasks(data[0]);
            setSelectedBatchDetail(data[0]);

            if (this_batchTasks?.tasks.length > 0) {
              setEvalTask({ ...this_batchTasks.tasks[0] });
              setBatchTasks([...this_batchTasks.tasks]);
              localStorage.setItem(
                "asr_active_batch",
                JSON.stringify(this_batchTasks)
              );
            }
            return; // This will prevent excution of next line of codes wich should excute on fail of one of these if statements
          }
        }

        // If one of the above if statements fiald, the next line of codes will be excuted
        setBatchesDetails([realtimeBatch]);
        setSelectedBatchDetail({ ...realtimeBatch });
        handleResetEvalTask(2);
      } catch (err) {
        console.error("Error fetching batch details:", err);
      }
    };
    handleResetEvalTask(2); // initilaizing the output fields
    fetchASRBatchDetails();
  }, [user]);

  return (
    <Container>
      <div className="w-full max-w-7xl space-y-5">
        <div className="w-full sm:p-0 flex flex-wrap sm:flex-nowrap justify-between items-center gap-1 sm:gap-2 rounded-md ">
          <SelectOption
            id="language"
            label="Language"
            name="language"
            value={selectedBatchDetail.source_language.iso_639_3}
            options={
              IsRealtime() ? languages : [selectedBatchDetail.source_language]
            }
            onChange={(selectedLang) =>
              setSelectedBatchDetail((prev) => {
                if (!prev) return prev; // Return null if prev is null
                return {
                  ...prev,
                  source_language: selectedLang,
                };
              })
            }
            labelClass="absolute md:left-3 border-r-2 md:pr-2.5 opacity-50"
            selectClass="md:pl-24"
            disabled={
              !selectedBatchDetail.batch_name.toLowerCase().includes("realtime")
            }
          />

          {selectedBatchDetail.batch_name.toLowerCase() == "realtime" && (
            <SelectTransparent
              id="models_to_eval"
              label="Models"
              name="modelsToEval"
              value={modelsToEval}
              optionsValues={Array.from(
                { length: asrModels.length - 1 },
                (_, i) => i + 2
              )}
              onChange={(e) => {
                const value = parseInt(JSON.stringify(e.target.value));
                setModelsToEval(value);
                handleResetEvalTask(value);
                setCurrentTaskIndex(0);
              }}
              labelClass="absolute left-3 border-r-2 pr-2.5"
              selectClass="p-[11px] pl-20"
            />
          )}

          {user?.username && (
            <SelectTransparent
              id="slected-dataset"
              label="Data"
              name="selectedBatchDetail"
              value={selectedBatchDetail.batch_id}
              optionsValues={[
                ...new Set(batchesDetails.map((item) => item.batch_id)),
              ]}
              optionsLabels={[
                ...new Set(
                  batchesDetails.map((item) => {
                    const percentile = `${item.annotated_tasks}/${item.number_of_tasks}`;
                    const title = `${item.batch_name}-${item?.batch_id}`;
                    return item.batch_name === "realtime"
                      ? item.batch_name
                      : `${percentile}: ${title}`;
                  })
                ),
              ]}
              onChange={(e) => {
                setIsLoading(true);
                setError(null);
                const value = e.target.value;
                const batchDetails = batchesDetails.find(
                  (item) => item.batch_id === value
                );
                if (batchDetails) {
                  setSelectedBatchDetail(batchDetails);
                  handleSelectedBatchUpdate(batchDetails);
                } else {
                  setSelectedBatchDetail(realtimeBatch);
                }
                setIsLoading(false);
              }}
              labelClass="absolute left-3 border-r-2 pr-2"
              selectClass="pl-14"
            />
          )}

          <ToggleButton
            id="toggle_trans_components_layouts"
            toggleIcon={isHorizontal}
            onClickToggle={() => setIsHorizontal(!isHorizontal)}
          />
        </div>

        <div
          className={`w-full block space-y-5 md:flex items-start justify-between space-x-5 ${
            isHorizontal ? "flex-row" : "flex-col"
          }`}
        >
          <AudioCard
            index={1}
            key={evalTask?.input}
            type="input"
            input_url={!!evalTask?.input ? evalTask.input : undefined}
            className={`${isHorizontal ? "md:max-w-[40%]" : ""}`}
            nodownload={!IsRealtime()}
          />
          <div
            className={`${
              isHorizontal ? "md:max-w-[60%]" : "w-full"
            } space-y-3`}
          >
            {evalTask?.models.map((task, index) => {
              return (
                <TranslationOutputArea
                  key={index}
                  index={index}
                  translation={task}
                  onClickRankUp={() => RankTranscription(index, index - 1)}
                  onClickRankDown={() => RankTranscription(index, index + 1)}
                  onClickRate={RateTranscription}
                  outputTextareaHeight={outputTextareaHeight}
                  error={error}
                  isLastItem={index === evalTask.models.length - 1}
                  isLoading={isLoading}
                  disabled={false}
                  type={"asr"}
                  rating_guideline={
                    selectedBatchDetail.rating_guideline ?? undefined
                  }
                />
              );
            })}

            <div
              className={`transition-all duration-600 ease-in-out overflow-hidden ${
                showReference
                  ? "max-h-[600px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <textarea
                key={evalTask?.id}
                id={`id_${evalTask?.id}`}
                placeholder="Add the correct transcription for the audio."
                className={`w-full p-3 h-fit min-h-45 md:min-h-36 rounded-md bg-gray-50 border border-gray-300 dark:bg-gray-800/80 dark:border-gray-700/80 dark:text-white focus:outline-blue-500 placeholder:text-sm placeholder:font-mono`}
                name={"reference"}
                value={evalTask?.reference ?? ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEvalTask((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      reference: e.target.value,
                    };
                  })
                }
              />
            </div>

            <DomainsList
              domains={selectedBatchDetail.domains ?? undefined}
              selectedDomains={evalTask?.domain ?? []}
              toggleDomainSelection={(name) =>
                setEvalTask((prev) => {
                  if (!prev) return prev;

                  const current = prev.domain ?? [];
                  const isSelected = current.includes(name);

                  return {
                    ...prev,
                    domain: isSelected
                      ? current.filter((d) => d !== name) // Remove if already selected
                      : [...current, name], // Add if not selected
                  };
                })
              }
            />

            <div className="flex items-center justify-between space-x-2 font-mono">
              <div className="w-fit flex space-x-2 items-center">
                <Button
                  variant="primary"
                  minimal
                  size="sm"
                  onClick={() => setShowReference(!showReference)}
                  className="!font-semibold"
                >
                   {showReference ? <><Minus className="size-4" /> Hide</> : <><Plus className="size-4" /> Add </>} Reference
                </Button>
              </div>
              <div className="flex items-center justify-end space-x-2 text-right">
                {currentTaskIndex > 0 && (
                  <Button
                    onClick={() => handlePreviousEvaluation()}
                    outline
                    size="sm"
                    text="Prev"
                    className="!px-8 !text-current !font-semibold"
                  />
                )}

                {selectedBatchDetail.batch_name.toLowerCase() !==
                  "realtime" && (
                  <span className="text-sm font-bold">
                    {currentTaskIndex + 1}/{batchTasks.length}
                  </span>
                )}

                <Button
                  onClick={() => handleSubmitEvaluation()}
                  outline
                  size="sm"
                  text={
                    selectedBatchDetail.batch_name.toLowerCase() === "realtime"
                      ? "Submit"
                      : isThereChangeInActiveTask()
                      ? "Save & Next"
                      : "Next"
                  }
                  className="!px-8 !text-current !font-semibold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
