import { calculateLeaderboard } from "@/helpers/batch_leaderboard_calculator";
import { ASRBatchTasksTypes, BatchTasksTypes } from "@/types/data";
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type SummaryType = {
  rates: Record<number | "unevaluated", number>;
  ranks: Record<number | "unevaluated", number>;
  withReference: number;
  domainCount: Record<string, number>;
};

type PropsTypes = {
  data: ASRBatchTasksTypes | BatchTasksTypes;
};

const TasksDetail = ({ data }: PropsTypes) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const truncate = (text: string, len = 30) =>
    text.length > len ? text.slice(0, len) + "..." : text;

  const getAllModelKeys = () => {
    const keys = new Set<string>();
    if (Array.isArray(data.tasks)) {
      data.tasks.forEach((d) => {
        if (Array.isArray(d.models)) {
          d.models.forEach((m) => keys.add(m.model));
        }
      });
    }
    return Array.from(keys).sort();
  };

  const modelKeys = getAllModelKeys();

  const summary: SummaryType = {
    rates: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      unevaluated: 0,
    },
    ranks: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      unevaluated: 0,
    },
    withReference: 0,
    domainCount: {},
  };

  if (Array.isArray(data.tasks)) {
    data.tasks.forEach((task) => {
      if (Array.isArray(task.models)) {
        task.models.forEach((model) => {
          // Count rates
          if (model.rate >= 1 && model.rate <= 5) {
            summary.rates[model.rate]++;
          } else {
            summary.rates.unevaluated++;
          }

          // Count ranks
          if (model.rank >= 1 && model.rank <= 5) {
            summary.ranks[model.rank]++;
          } else {
            summary.ranks.unevaluated++;
          }
        });
      }

      if (task.reference && task.reference.trim() !== "") {
        summary.withReference++;
      }

      if (Array.isArray(task.domain) && task.domain.length > 0) {
        task.domain.forEach((d) => {
          summary.domainCount[d] = (summary.domainCount[d] || 0) + 1;
        });
      }
    });
  }

  const leaderB = Array.isArray(data.tasks) 
    ? calculateLeaderboard(data.tasks, data?.task_models_shuffles)
    : [];

  return (
    <div className="overflow-auto !max-h-[90vh] p-3 mt-5 text-gray-800 dark:text-gray-200 dark:bg-gray-900">
      {/* Summary Section */}
      <div className="mb-4 p-4 bg-gray-200/50 dark:bg-gray-800/50 rounded text-sm border border-gray-200 dark:border-gray-700">
        <div className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Evaluation Summary
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="font-bold text-lg">Ratings:</div>
            <ul className="ml-4 list-disc">
              {Object.entries(summary.rates).map(([key, count]) => (
                <li key={key}>
                  {key === "unevaluated" ? "Unevaluated" : `Rated ${key}`} –{" "}
                  {key === "unevaluated" ? count / 2 : count}
                </li>
              ))}
            </ul>
          </div>

          {/* <div>
            <div className="font-bold text-lg">Ranks:</div>
            <ul className="ml-4 list-disc">
              {Object.entries(summary.ranks).map(([key, count]) => (
                <li key={key}>
                  {key === "unevaluated" ? "Unranked" : `Rank ${key}`} – {count}
                </li>
              ))}
            </ul>
          </div> */}

          <div>
            <div className="font-bold text-lg">Categories:</div>
            <ul className="ml-4 list-disc">
              {Object.entries(summary.domainCount).map(([domain, count]) => (
                <li key={domain}>
                  {domain}: {count}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-bold text-lg">References:</div>
            <p>{summary.withReference} tasks have references</p>
          </div>

          <div>
            <div className="font-bold text-lg">Leaderboard:</div>
            {leaderB.map((item, i) => {
              return (
                <p key={i} className="space-x-2 font-mono">
                  <span>
                    {item.overall_rank} ➝ {item.model}
                  </span>
                  <span className="text-xs opacity-70 bg-gray-300 dark:bg-gray-700 px-2 py-[1px] rounded-full">
                    Rank: <strong>{JSON.stringify(item.rank)}</strong>
                    {/* <strong>{Number(item.avg_rank.toFixed(3))}</strong> */}
                  </span>
                  <span className="text-xs opacity-70 bg-gray-300 dark:bg-gray-700 px-2 py-[1px] rounded-full">
                    Avg Rate:{" "}
                    <strong>{Number(item.avg_rate.toFixed(3))}</strong>
                  </span>
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <table className="min-w-full rounded text-sm border border-gray-300 dark:border-gray-800">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="p-2 border border-gray-300 dark:border-gray-800 text-left w-10">
              #
            </th>
            <th className="p-2 border border-gray-300 dark:border-gray-800 text-left">
              Input
            </th>
            {modelKeys.map((model) => (
              <th
                key={model}
                className="p-2 border border-gray-300 dark:border-gray-800 text-left"
              >
                Model {model}
              </th>
            ))}
            <th className="p-2 border border-gray-300 dark:border-gray-800 text-left">
              Reference
            </th>
            <th className="p-2 border border-gray-300 dark:border-gray-800 text-left">
              Domain
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(data.tasks) && data.tasks.map((task) => {
            const isExpanded = expandedIds[task.id] || false;
            return (
              <tr
                key={task.id}
                className="border-t border-gray-300 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/20"
              >
                <td className="p-2 items-center space-x-1 text-center align-top">
                  <span>{task.id}</span>
                  <button
                    onClick={() => toggleExpand(`${task.id}`)}
                    className="ml-1 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white cursor-pointer"
                    aria-label="Toggle expand"
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-4 inline" />
                    ) : (
                      <ChevronDown className="size-4 inline" />
                    )}
                  </button>
                </td>

                <td className="p-2 border align-top max-w-sm border-gray-300 dark:border-gray-800">
                  {isExpanded ? task.input : truncate(task.input)}
                </td>

                {modelKeys.map((modelKey) => {
                  const model = Array.isArray(task.models) 
                    ? task.models.find((m) => m.model === modelKey)
                    : undefined;
                  return (
                    <td
                      key={modelKey}
                      className="p-2 border align-top border-gray-300 dark:border-gray-800"
                    >
                      {model ? (
                        <>
                          <div className="font-medium text-gray-700 dark:text-gray-200 mb-1">
                            {isExpanded ? model.output : truncate(model.output)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <strong>Rank:</strong> {model.rank ?? "N/A"},{" "}
                            <strong>Rate:</strong> {model.rate ?? "N/A"}
                          </div>
                        </>
                      ) : (
                        <span className="italic text-gray-400">N/A</span>
                      )}
                    </td>
                  );
                })}

                <td className="p-2 border align-top max-w-sm border-gray-300 dark:border-gray-800">
                  {isExpanded ? task.reference : truncate(task.reference || "")}
                </td>

                <td className="p-2 border align-top border-gray-300 dark:border-gray-800">
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(task.domain) && task.domain.length > 0 &&
                      task.domain.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TasksDetail;
