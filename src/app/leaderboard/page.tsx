"use client";
import SelectTransparent from "@/components/inputs/SelectTransparent";
import TextInput from "@/components/inputs/TextInput";
import React, { useState } from "react";

import data from "../../dataset/leaderboard/09_06_2025.json";
import bleu_data from "../../dataset/leaderboard/ranked_bleu_score_metrics.json";
import TabButton from "@/components/utils/TabButton";
import Container from "@/components/utils/Container";

type columnType = {
  label: string;
  key: string;
};

// Define a type for your model data (simplified for example)
type ModelType = {
  rank: number;
  model: string;
  rate_avg?: number;
  rate_sd?: number;
  votes?: number;
  bleu?: number;
  chrf?: number;
  dataset_name?: string;
  dataset_size?: number;
  direction?: string;
  organization: string;
  license: string;
  // Add other properties as they exist in your data
};

export default function Leaderboard() {
  const [evalType, setEvalType] = useState<"human" | "bleu">("human");
  const [pinnedModels, setPinnedModels] = useState<ModelType[]>([]);

  const tableData = {
    human: {
      columns: [
        { label: "Rank (UB)", key: "rank" },
        { label: "Model", key: "model" },
        { label: "Rate avg (μ)", key: "rate_avg" },
        { label: "Rate SD (σ)", key: "rate_sd" },
        { label: "Dataset", key: "dataset_name" },
        { label: "Dataset Size", key: "votes" },
        { label: "Organization", key: "organization" },
        { label: "License", key: "license" },
      ],
      models: data?.models ?? [],
    },
    bleu: {
      columns: [
        { label: "Rank (UB)", key: "rank" },
        { label: "Model", key: "model" },
        { label: "BLEU", key: "bleu" },
        { label: "CHRF", key: "chrf" },
        { label: "Dataset", key: "dataset_name" },
        { label: "Dataset Size", key: "dataset_size" },
        { label: "Direction", key: "direction" },
        { label: "Organization", key: "organization" },
        { label: "License", key: "license" },
      ],
      models: bleu_data?.models ?? [],
    },
  };

  const currentModels = tableData[evalType].models as ModelType[];
  const currentColumns = tableData[evalType].columns;

  const togglePinModel = (modelToToggle: ModelType) => {
    setPinnedModels((prevPinnedModels) => {
      const isPinned = prevPinnedModels.some(
        (m) => m.rank === modelToToggle.rank
      );

      if (isPinned) {
        // If pinned, unpin it
        return prevPinnedModels.filter((m) => m.rank !== modelToToggle.rank);
      } else {
        // If not pinned, pin it (add to the array)
        // No limit imposed here, allowing any number of pins
        return [...prevPinnedModels, modelToToggle];
      }
    });
  };

  const filteredModels = currentModels.filter(
    (model) => !pinnedModels.some((pModel) => pModel.rank === model.rank)
  );

  // Helper to check if a model is currently pinned
  const isModelPinned = (model: ModelType) =>
    pinnedModels.some((pModel) => pModel.rank === model.rank);

  return (
    <Container>
      <div className="w-full max-w-7xl space-y-6">
        <div className="block space-y-5 md:flex justify-between items-center w-full">
          <div className="w-fit flex space-x-3">
            <TabButton
              text="Human evaluation"
              onClick={() => {
                setPinnedModels([]);
                setEvalType("human");
              }}
              active={evalType === "human"}
            />
            <TabButton
              text="Automatic Metrics"
              onClick={() => {
                setPinnedModels([]);
                setEvalType("bleu");
              }}
              active={evalType === "bleu"}
            />
          </div>
          <div className="flex flex-wrap gap-10 font-mono">
            <div className="block">
              <p className="text-sm opacity-40">Last Updated: </p>
              <p className="font-medium">{data?.updated_at}</p>
            </div>
            <div>
              <p className="text-sm opacity-40">Total Votes: </p>
              <p className="font-medium">{data?.total_votes}</p>
            </div>
            <div>
              <p className="text-sm opacity-40">Total Models: </p>
              <p className="font-medium">{data?.models.length}</p>
            </div>
          </div>
        </div>

        <div className="w-full flex justify-between items-center text-gray-400 space-x-3">
          <SelectTransparent
            key={"eval_type"}
            id="eval_type"
            name="eval_type"
            value={""}
            variant="outlined"
            selectClass="pl-2"
            optionsValues={[
              "Overall",
              "HornMT",
              "Flores Plus",
              "Masakhane",
              "AGE",
            ]}
            onChange={() => {}}
          />
          <TextInput
            type="text"
            name=""
            value=""
            placeholder="Search by model name..."
            onChange={() => {}}
          />
          <SelectTransparent
            key={"eval_domain"}
            id="eval_domain"
            name="eval_domain"
            value={""}
            variant="outlined"
            selectClass="pl-2"
            optionsValues={[
              "General",
              "Health",
              "Technology",
              "Education",
              "Politics",
              "News",
            ]}
            onChange={() => {}}
          />
        </div>

        <div className="overflow-x-auto border-1 rounded-md border-gray-300 dark:border-gray-800 bg-gray-200/30 dark:bg-gray-800/30">
          <table className="min-w-full px-2 py-4 text-left border-spacing-y-2">
            <thead className="border-b-1 rounded-3xl font-mono border-gray-300 dark:border-gray-800 py-5">
              <tr>
                <th className="p-3">Rank (UB)</th>
                {currentColumns.slice(1).map((item: columnType, i) => {
                  return (
                    <th key={i} className="p-3">
                      {item.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Render Pinned Models */}
              {pinnedModels.length > 0 && (
                <>
                  <tr className="bg-blue-100 dark:bg-blue-900/30">
                    <td
                      colSpan={currentColumns.length + 1}
                      className="px-3 p-1 font-bold text-sm font-mono text-blue-800 dark:text-blue-200"
                    >
                      Pinned Models
                    </td>
                  </tr>
                  {pinnedModels.map((model, i) => (
                    <tr
                      key={`pinned_${model.model}_${i}`}
                      className="rounded-lg transition-all bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 hover:dark:bg-blue-900"
                    >
                      {currentColumns.map((item: columnType, j) => {
                        const key = item.key;
                        const value = (model as Record<string, unknown>)[key];
                        return (
                          <td key={`${i}_${j}`} className="p-3">
                            {item.key === "rank" ? (
                              <button
                                onClick={() => togglePinModel(model)}
                                className="mr-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                                title="Unpin"
                              >
                                &#x2715; {/* Unicode for pushpin */}
                              </button>
                            ) : null}
                            {value != null ? String(value) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-blue-100 dark:bg-blue-900/30">
                    <td colSpan={currentColumns.length + 1} className="p-3">
                      &nbsp; {/* Empty row for separation */}
                    </td>
                  </tr>
                </>
              )}

              {/* Render Main Table Models */}
              {filteredModels.map((model, i) => (
                <tr
                  key={`main_${model.model}_${i}`}
                  className="rounded-lg transition-all hover:bg-gray-200 hover:dark:bg-gray-800"
                >
                  {currentColumns.map((item: columnType, j) => {
                    const key = item.key;
                    const value = (model as Record<string, unknown>)[key];
                    const isRank = item.key === "rank";
                    return (
                      <td
                        key={`${i}_${j}`}
                        className={`p-3 ${isRank ? "flex" : ""}`}
                      >
                        {isRank && !isModelPinned(model) ? (
                          <button
                            onClick={() => togglePinModel(model)}
                            className="mr-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 cursor-pointer"
                            title="Pin for comparison"
                          >
                            &#128204; {/* Unicode for pushpin */}
                          </button>
                        ) : null}
                        {value != null ? String(value) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredModels.length === 0 && pinnedModels.length === 0 && (
                <tr>
                  <td
                    colSpan={currentColumns.length + 1}
                    className="p-3 text-center text-gray-600"
                  >
                    No models to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  );
}
