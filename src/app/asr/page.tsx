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
import { Loader2, Minus, Plus } from "lucide-react";
import { useReviewerMode } from "@/hooks/useReviewerMode";
import ReviewerPanel from "@/components/ReviewerPanel";
import ReviewerCommentDisplay from "@/components/ReviewerCommentDisplay";

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

  const {
    isReviewerMode,
    reviewerComment,
    setReviewerComment,
    savingComment,
    handleSaveReviewerComment,
    handleReviewerNext,
    handleReviewerPrev,
  } = useReviewerMode({
    user,
    selectedBatchDetail,
    batchTasks,
    currentTaskIndex,
    evalTask,
    setEvalTask,
    setBatchTasks,
    setCurrentTaskIndex,
  });

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
        setReviewerComment(this_batchTasks.tasks[0]?.reviewer_comment ?? "");
        localStorage.setItem(
          "asr_active_batch",
          JSON.stringify({
            ...this_batchTasks,
            batch_id: batch.batch_id,
            dataset_type: batch.dataset_type,
            currentTaskIndex: 0,
          })
        );
      } else {
        handleResetEvalTask(modelsToEval);
      }
    }
  };

  const handlePreviousEvaluation = () => {
    if (currentTaskIndex > 0) {
      setError(null);
      const prevIndex = currentTaskIndex - 1;
      setCurrentTaskIndex(prevIndex);
      setEvalTask(batchTasks[prevIndex]);
      if (
        !selectedBatchDetail.batch_name.toLowerCase().includes("realtime")
      ) {
        localStorage.setItem(
          "asr_active_batch",
          JSON.stringify({
            ...selectedBatchDetail,
            batch_id: selectedBatchDetail.batch_id,
            dataset_type: selectedBatchDetail.dataset_type,
            tasks: batchTasks,
            currentTaskIndex: prevIndex,
          })
        );
      }
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
    const res = await fetch(`/api/batches-details/${selectedBatchDetail.batch_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batchDetail), // full updated batch object including all fields
    });
    if (!res.ok) throw new Error("Failed to update batch detail");
    setSelectedBatchDetail({ ...batchDetail });
    setBatchesDetails((prev: BatchDetailTypes[]) =>
      prev.map((batch) =>
        batch.batch_id === batchDetail.batch_id ? batchDetail : batch
      )
    );
  };

  const handleSaveTaskChanges = async () => {
    if (!evalTask) return null;
    const res = await fetch(
      `/api/batches/${selectedBatchDetail.dataset_type}/${selectedBatchDetail.batch_id}/tasks/${evalTask.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(evalTask),
      }
    );
    if (!res.ok) throw new Error("Failed to save task changes");
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

      // STEP 5. Save the updated task into database if there is a change only
      if (isThereChangeInActiveTask()) {
        try {
          await handleSaveTaskChanges();

          // Count the number of Evaluated tasks
          const evaluatedTasks = updatedTasks.filter(
            (item) => item.models.some((m) => m.rate > 0 && m.rank > 0)
          );
          await updateBatchDetail({
            ...selectedBatchDetail,
            annotated_tasks: evaluatedTasks.length,
          });
        } catch {
          alert("Failed to save evaluation. Please try again.");
          return;
        }
      }

      const nextIndex = currentTaskIndex + 1;
      if (nextIndex < batchTasks.length) {
        const nextTask = batchTasks[nextIndex];
        setEvalTask(nextTask);
        setCurrentTaskIndex(nextIndex);
        localStorage.setItem(
          "asr_active_batch",
          JSON.stringify({
            ...selectedBatchDetail,
            batch_id: selectedBatchDetail.batch_id,
            dataset_type: selectedBatchDetail.dataset_type,
            tasks: updatedTasks,
            currentTaskIndex: nextIndex,
          })
        );
      } else {
        setCurrentTaskIndex(0);
        setEvalTask(updatedTasks[0]);
        alert(
          `End of <${selectedBatchDetail.batch_name}> ASR evaluation tasks! Back to first task.`
        );
        localStorage.setItem(
          "asr_active_batch",
          JSON.stringify({
            ...selectedBatchDetail,
            batch_id: selectedBatchDetail.batch_id,
            dataset_type: selectedBatchDetail.dataset_type,
            tasks: updatedTasks,
            currentTaskIndex: 0,
          })
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
    if ((evalTask?.models.length ?? 1) <= 2) {
      setOutputTextareaHeight(`md:min-h-25`);
    } else if (evalTask?.models.length === 3) {
      setOutputTextareaHeight(`md:min-h-19`);
    } else {
      setOutputTextareaHeight("md:min-h-12");
    }
  }, [evalTask]);

  useEffect(() => {
    const fetchASRBatchDetails = async () => {
      setIsLoading(true);
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

            const active_batch = localStorage.getItem("asr_active_batch") || null;
            if (active_batch) {
              try {
                const batch_json = JSON.parse(active_batch) as ASRBatchTasksTypes & {
                  currentTaskIndex?: number;
                };
                const storedBatchId = batch_json.batch_id;
                const storedIndex = Math.max(0, batch_json.currentTaskIndex ?? 0);
                const existingSelectedBatch = data.find(
                  (item) => item.batch_id === storedBatchId
                );
                if (existingSelectedBatch) {
                  const freshBatch = await FetchBatchTasks(existingSelectedBatch);
                  const tasks = Array.isArray(freshBatch?.tasks)
                    ? freshBatch.tasks
                    : [];
                  if (tasks.length > 0) {
                    const idx = Math.min(storedIndex, tasks.length - 1);
                    setSelectedBatchDetail(existingSelectedBatch);
                    setBatchTasks([...tasks]);
                    setCurrentTaskIndex(idx);
                    setEvalTask({ ...tasks[idx] });
                    localStorage.setItem(
                      "asr_active_batch",
                      JSON.stringify({
                        ...freshBatch,
                        batch_id: existingSelectedBatch.batch_id,
                        dataset_type: existingSelectedBatch.dataset_type,
                        tasks,
                        currentTaskIndex: idx,
                      })
                    );
                    return;
                  }
                }
              } catch {
                // Invalid stored data; fall through to load first batch
              }
            }

            const firstBatch = data[0];
            setSelectedBatchDetail(firstBatch);
            const this_batchTasks = await FetchBatchTasks(firstBatch);
            if (this_batchTasks?.tasks?.length > 0) {
              setEvalTask({ ...this_batchTasks.tasks[0] });
              setBatchTasks([...this_batchTasks.tasks]);
              localStorage.setItem(
                "asr_active_batch",
                JSON.stringify({
                  ...this_batchTasks,
                  batch_id: firstBatch.batch_id,
                  dataset_type: firstBatch.dataset_type,
                  currentTaskIndex: 0,
                })
              );
            }
            return;
          }
        }

        // If one of the above if statements fiald, the next line of codes will be excuted
        setBatchesDetails([realtimeBatch]);
        setSelectedBatchDetail({ ...realtimeBatch });
        handleResetEvalTask(2);
      } catch (err) {
        console.error("Error fetching batch details:", err);
      } finally {
        setIsLoading(false);
      }
    };
    handleResetEvalTask(2); // initilaizing the output fields
    fetchASRBatchDetails();
  }, [user?.username]);

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
                  batchesDetails.map((item) => item.batch_name)
                ),
              ]}
              onChange={async (e) => {
                setIsLoading(true);
                setError(null);
                const value = e.target.value;
                const batchDetails = batchesDetails.find(
                  (item) => item.batch_id === value
                );
                try {
                  if (batchDetails) {
                    setSelectedBatchDetail(batchDetails);
                    await handleSelectedBatchUpdate(batchDetails);
                  } else {
                    setSelectedBatchDetail(realtimeBatch);
                  }
                } finally {
                  setIsLoading(false);
                }
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
          {isLoading ? (
            <div className="w-full min-h-[280px] flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/30">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Loading…
                </span>
              </div>
            </div>
          ) : (
            <>
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
              isHorizontal ? "md:max-w-[60%] w-full" : "w-full"
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
                  readOnly={isReviewerMode}
                  type={"asr"}
                  rating_guideline={
                    selectedBatchDetail.rating_guideline ?? undefined
                  }
                />
              );
            })}

            {isReviewerMode ? (
              <ReviewerPanel
                evalTask={evalTask}
                reviewerComment={reviewerComment}
                setReviewerComment={setReviewerComment}
                savingComment={savingComment}
                onSaveComment={handleSaveReviewerComment}
                onNext={handleReviewerNext}
                onPrev={handleReviewerPrev}
                currentTaskIndex={currentTaskIndex}
                totalTasks={batchTasks.length}
                referencePlaceholder="Reference transcription"
              />
            ) : (
              <>
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
                    className={`w-full p-3 h-fit min-h-45 md:min-h-36 rounded-md bg-neutral-50 border border-neutral-300 dark:bg-neutral-800/80 dark:border-neutral-700/80 dark:text-white focus:outline-blue-500 placeholder:text-sm placeholder:font-mono`}
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

                <ReviewerCommentDisplay comment={evalTask?.reviewer_comment ?? ""} />

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
                          ? current.filter((d) => d !== name)
                          : [...current, name],
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
              </>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
