"use client";
import { useUser } from "@/context/UserContext";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  BatchTasksTypes,
} from "@/types/data";
import { EvalTypeTypes } from "@/types/others";
import { useState, useEffect, Dispatch } from "react";
import TasksDetail from "./TasksDetail";
import Modal from "../utils/Modal";
import { Download, Expand, X } from "lucide-react";

const getProgressColor = (percentage: number): string => {
  if (percentage < 40) return "bg-red-500";
  if (percentage < 70) return "bg-yellow-500";
  return "bg-green-500";
};

/** Escape a CSV field (quote if needed, double internal quotes). */
function escapeCSV(value: string): string {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convert batch (MT or ASR) to CSV: one row per (task, model). Columns: task_id, input, output, model, domain, rate, rank, reference. */
function batchToCSV(
  batch: ASRBatchTasksTypes | BatchTasksTypes
): string {
  const headers = [
    "task_id",
    "input",
    "output",
    "model",
    "domain",
    "rate",
    "rank",
    "reference",
  ];
  const rows: string[][] = [headers];

  for (const task of batch.tasks ?? []) {
    const taskId = String(task.id ?? "");
    const input = task.input ?? "";
    const reference = task.reference ?? "";
    const domain = Array.isArray(task.domain) ? task.domain.join("; ") : (task.domain ?? "");

    for (const m of task.models ?? []) {
      rows.push([
        taskId,
        input,
        m.output ?? "",
        m.model ?? "",
        domain,
        String(m.rate ?? ""),
        String(m.rank ?? ""),
        reference,
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
}

type DatasetsTableProps = {
  batches_details: BatchDetailTypes[];
  setBatchDetails: Dispatch<React.SetStateAction<BatchDetailTypes[]>>;
  loading: boolean;
  setLoading: Dispatch<React.SetStateAction<boolean>>;
  evalDataType: EvalTypeTypes;
  /** Increment to trigger a refetch (e.g. from Refresh button). */
  refreshKey?: number;
};

export default function DatasetsTable({
  batches_details,
  setBatchDetails,
  loading,
  setLoading,
  evalDataType,
  refreshKey = 0,
}: DatasetsTableProps) {
  // TODO: add filter feature across the table by each of the column names
  const { user } = useUser();
  const [editFile, setEditFile] = useState<number | null>(null);
  const [activeBatch, setActiveBatch] = useState<
    ASRBatchTasksTypes | BatchTasksTypes | null
  >(null);
  const [editedAnnotatorId, setEditedAnnotatorId] = useState<string | number>(
    ""
  );
  const [filters, setFilters] = useState({
    batch_name: "",
    dataset_domain: "",
    source_language: "",
    target_language: "",
    models: "",
    created_by: "",
    annotator_id: "",
  });
  const [downloadMenuIndex, setDownloadMenuIndex] = useState<number | null>(
    null
  );
  const [dwnldOriginalData, setDwnldOriginalData] = useState<boolean>(true);

  // Fetch only on mount (when username is ready), tab change, or manual refresh
  useEffect(() => {
    if (!user?.username) return;

    let cancelled = false;
    const fetchBatchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/batches-details?username=${user.username}&dataset_type=${evalDataType.value}`
        );
        if (!res.ok) throw new Error("Failed to fetch batch details");
        const data: BatchDetailTypes[] = await res.json();
        if (!cancelled) setBatchDetails(data);
      } catch (err) {
        if (!cancelled) console.error("Error fetching batch details:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBatchDetails();
    return () => {
      cancelled = true;
    };
  }, [user?.username, evalDataType.value, refreshKey, setBatchDetails, setLoading]);

  const handleDownload = async (
    batch_detail: BatchDetailTypes,
    format: string
  ) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/batches/${evalDataType.value}/${batch_detail.batch_id}?include_models_shuffles=true`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch batch data from server.");
      }

      const batch = await res.json();

      // De-annonmization of task models to the orginal mapping.
      if (dwnldOriginalData && !!batch.task_models_shuffles) {
        const deAnnoTasks = [];

        for (const task of batch.tasks) {
          const taskID = task.id;
          const shuffleMap = batch.task_models_shuffles?.[taskID];

          const deAnnoModels = [];
          for (const model of task.models) {
            const fakeModelName = model.model;
            const originalModelName = shuffleMap
              ? shuffleMap[fakeModelName]
              : fakeModelName;
            model.model = originalModelName;
            deAnnoModels.push(model);
          }

          task.models = deAnnoModels;
          deAnnoTasks.push(task);
        }

        batch.tasks = deAnnoTasks;
        delete batch.task_models_shuffles; // removing mapping
      }

      const isCSV = format === "csv";
      let blob: Blob;
      let filename: string;

      if (isCSV) {
        const csv = batchToCSV(batch);
        blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        filename = `${batch_detail.batch_name}_${batch_detail.batch_id}_batch_tasks.csv`;
      } else {
        const json = JSON.stringify(batch, null, 2);
        blob = new Blob([json], { type: "application/json" });
        filename = `${batch_detail.batch_name}_${batch_detail.batch_id}_batch_tasks.json`;
      }

      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Could not download the batch tasks.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (batch_detail: BatchDetailTypes) => {
    const batch_id = batch_detail.batch_id;
    const confirmed = window.confirm(
      "Are you sure you want to delete this batch? This action cannot be undone."
    );
    if (!confirmed) return;
    setLoading(true);
    const res = await fetch(`/api/batches/${batch_detail.dataset_type}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...batch_detail,
      }),
    });

    if (!res.ok) {
      alert("Deleting batch faild!");
      setLoading(false);
      return;
    }

    // Remove the item from the state
    const tasks_CPY = [...batches_details];
    const detials = tasks_CPY.filter((t) => t.batch_id !== batch_id);

    // Remove the Item if it is in the local storage as an active batch
    if (batch_detail.dataset_type === "mt") {
      const actv_batch = JSON.parse(
        localStorage.getItem("active_batch") || "{}"
      );
      if (actv_batch?.batch_id === batch_id) {
        localStorage.removeItem("active_batch");
      }
    } else if (batch_detail.dataset_type === "asr") {
      const asr_actv_batch = JSON.parse(
        localStorage.getItem("asr_active_batch") || "{}"
      );
      if (asr_actv_batch?.batch_id === batch_id) {
        localStorage.removeItem("asr_active_batch");
      }
    }

    setBatchDetails([...detials]);
    setLoading(false);
  };

  const handleAssignAnnotator = async (batch_detail: BatchDetailTypes) => {
    const anno_email = `${editedAnnotatorId}`.trim().toLocaleString() ?? null;

    if (batch_detail.annotator_id?.trim().toLocaleLowerCase() === anno_email) {
      alert(`The batch is already assigned to ${anno_email}.`);
      setEditFile(null);
      return null;
    }

    if (!user?.email && !user?.username) {
      alert(
        "Unautorized user or your session is expired. Please signin again."
      );
      setEditFile(null);
      return null;
    }

    setLoading(true);
    try {
      const batchID = batch_detail?.batch_id;
      const res = await fetch(`/api/batches-details/${batchID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ annotator_id: anno_email }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to save batch to server.");
      }

      const updatedTasks = batches_details.map((detail) =>
        detail.batch_id === batchID
          ? { ...detail, annotator_id: anno_email }
          : detail
      ) as BatchDetailTypes[];
      setBatchDetails(updatedTasks);
      setEditFile(null);
      setEditedAnnotatorId("");
      // alert(res?.message);
    } catch (error) {
      alert(error);
    }

    setLoading(false);
  };

  const IsAuthorized = (batch_detail: BatchDetailTypes) => {
    return batch_detail.created_by === user?.username;
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleShowTasksDetail = async (batch_detail: BatchDetailTypes) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/batches/${batch_detail.dataset_type}/${batch_detail.batch_id}?include_models_shuffles=true`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch batch data from server.");
      }

      const batch = await res.json();
      console.log("res batch:", batch);

      setActiveBatch(batch);
      setLoading(false);
    } catch (error) {
      alert(error);
    }
  };

  const filteredBatches = batches_details.filter((detail) => {
    return (
      (detail.batch_name ?? "")
        .toLowerCase()
        .includes(filters.batch_name.toLowerCase()) &&
      (detail.dataset_domain ?? "")
        .toLowerCase()
        .includes(filters.dataset_domain.toLowerCase()) &&
      (detail.source_language?.iso_639_3 ?? "")
        .toLowerCase()
        .includes(filters.source_language.toLowerCase()) &&
      (detail.target_language?.iso_639_3 ?? "")
        .toLowerCase()
        .includes(filters.target_language.toLowerCase()) &&
      (detail.models ?? [])
        .join(",")
        .toLowerCase()
        .includes(filters.models.toLowerCase()) &&
      (detail.created_by ?? "")
        .toLowerCase()
        .includes(filters.created_by.toLowerCase()) &&
      (detail.annotator_id ?? "")
        .toString()
        .toLowerCase()
        .includes(filters.annotator_id.toLowerCase())
    );
  });

  const filterFields = [
    { key: "batch_name", placeholder: "Filter by name" },
    { key: "dataset_domain", placeholder: "Filter by domain" },
    {
      key: "language_pair",
      type: "dual", // for from-to filter
      placeholders: ["From", "To"],
    },
    { key: "models", placeholder: "Model" },
    { key: "", type: "spacer" }, // empty th for 'Created At'
    { key: "created_by", placeholder: "Creator" },
    { key: "annotator_id", placeholder: "Annotator" },
    { key: "", type: "spacer" }, // Progress
    { key: "", type: "spacer" }, // Actions
  ];

  return (
    <div className="relative min-h-[55lvh]">
      <div className="overflow-x-auto border-1 rounded-md border-neutral-300 dark:border-neutral-800 bg-neutral-200/30 dark:bg-neutral-800/30">
        <table className="min-w-full px-2 py-4 text-left border-spacing-y-2">
          <thead className="border-b-1 rounded-3xl font-mono border-neutral-300 dark:border-neutral-800 py-5">
            <tr>
              <th className="px-4 py-4 text-left">#</th>
              <th className="px-4 py-4 text-left">Dataset</th>
              <th className="px-4 py-4 text-left">Domain</th>
              <th className="px-4 py-4 text-left">From-To</th>
              <th className="px-4 py-4 text-left">Models</th>
              <th className="px-4 py-4 text-left">created At</th>
              <th className="px-4 py-4 text-left">created By</th>
              <th className="px-4 py-4 text-left">Assigned To</th>
              <th className="px-4 py-4 text-left">Progress</th>
              <th className="px-4 py-4 text-left">Actions</th>
            </tr>
            <tr className="bg-neutral-100 dark:bg-neutral-900 text-xs">
              <th> {/* Serial column */} </th>
              {filterFields.map((field, idx) => {
                if (field.type === "spacer") return <th key={idx} />;
                if (field.type === "dual") {
                  return (
                    <th key={idx}>
                      <div className="flex space-x-1">
                        <input
                          className="w-1/2 p-1 rounded"
                          placeholder={field.placeholders?.[0]}
                          value={filters.source_language}
                          onChange={(e) =>
                            handleFilterChange(
                              "source_language",
                              e.target.value
                            )
                          }
                        />
                        <input
                          className="w-1/2 p-1 rounded"
                          placeholder={field.placeholders?.[1]}
                          value={filters.target_language}
                          onChange={(e) =>
                            handleFilterChange(
                              "target_language",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </th>
                  );
                }
                return (
                  <th key={idx}>
                    <input
                      className="w-full p-1 rounded"
                      placeholder={field.placeholder}
                      value={filters[field.key as keyof typeof filters]}
                      onChange={(e) =>
                        handleFilterChange(field.key, e.target.value)
                      }
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="relative md:static">
            {filteredBatches.length > 0 ? (
              filteredBatches.map((batch_detail, index) => {
                const annotatedItems = parseInt(
                  `${batch_detail.annotated_tasks}`
                );
                const percent =
                  (annotatedItems / batch_detail.number_of_tasks) * 100;
                const progressColor = getProgressColor(percent);

                return (
                  <tr
                    key={`${batch_detail.batch_id}, ${index}`}
                    className="border-t border-neutral-200 dark:border-neutral-700"
                  >
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">{batch_detail.batch_name}</td>
                    <td className="px-3 py-2">{batch_detail.dataset_domain}</td>
                    <td className="px-3 py-2">
                      {batch_detail.source_language?.iso_639_3 ?? ""} -{" "}
                      {batch_detail.target_language?.iso_639_3 ?? ""}
                    </td>
                    <td className="px-3 py-2 break-words max-w-[150px] text-xs font-mono space-x-1">
                      {(batch_detail.models ?? []).map((item, i) => {
                        return <i key={i}>{item},</i>;
                      })}
                    </td>
                    <td className="px-3 py-2">{batch_detail.created_at}</td>
                    <td
                      className="px-3 py-2 text-sm font-mono"
                      title={batch_detail.created_by}
                    >
                      {(batch_detail.created_by ?? "").length > 15
                        ? `${batch_detail.created_by.slice(0, 15)}...`
                        : batch_detail.created_by ?? ""}
                    </td>
                    <td className="px-3 py-2 space-x-0.5 text-sm font-mono flex justify-between items-center">
                      {editFile !== index && (
                        <span
                          onDoubleClick={() => {
                            setEditFile(index);
                            setEditedAnnotatorId(
                              batch_detail.annotator_id ?? ""
                            );
                          }}
                        >
                          {!!batch_detail.annotator_id
                            ? batch_detail.annotator_id
                            : "N/A"}
                        </span>
                      )}
                      {editFile === index && (
                        <input
                          name={`input_${index}`}
                          value={editedAnnotatorId}
                          onChange={(e) => setEditedAnnotatorId(e.target.value)}
                          type="text"
                          placeholder="Email"
                          className="border rounded p-[2px] focus:outline-none w-full"
                        />
                      )}

                      {/* UPdating annotator-id is allowed only to the creator of the batch */}
                      {IsAuthorized(batch_detail) && (
                        <div className="px-0.5">
                          {(editFile === null || editFile !== index) && (
                            <span
                              className="w-full p-1 rounded cursor-pointer"
                              onClick={() => {
                                setEditFile(index);
                                setEditedAnnotatorId(
                                  batch_detail.annotator_id ?? ""
                                );
                              }}
                            >
                              ✏️
                            </span>
                          )}

                          {editFile === index && (
                            <p className="flex items-center space-x-2">
                              <span
                                className="w-full p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                onClick={() => {
                                  handleAssignAnnotator(batch_detail);
                                }}
                                title="Save change"
                              >
                                ✔
                              </span>
                              <span
                                className="w-full p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                onClick={() => {
                                  setEditFile(null);
                                  setEditedAnnotatorId("");
                                }}
                                title="Cancel change"
                              >
                                ✖
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 w-56">
                      <div className="w-full bg-neutral-200 dark:bg-neutral-600 h-3 rounded-full">
                        <div
                          className={`h-3 rounded-full ${progressColor}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 mt-1 font-mono">
                        {annotatedItems}/{batch_detail.number_of_tasks}
                      </div>
                    </td>
                    <td className="px-3 py-2 flex space-x-3 min-w-46">
                      {/* <button
                      onClick={() => handleDownload(batch_detail)}
                      className="text-blue-600 dark:text-blue-400 cursor-pointer rounded-md border border-transparent hover:border-current p-1"
                      title="Download"
                    >
                      <Download className="size-6" />
                    </button> */}
                      <button
                        onClick={() => {
                          if (downloadMenuIndex === index) {
                            setDownloadMenuIndex(null);
                          } else {
                            setDownloadMenuIndex(index);
                          }
                        }}
                        className="text-blue-600 dark:text-blue-400 cursor-pointer rounded-md border border-transparent hover:border-current p-1"
                        title="Download"
                      >
                        <Download className="size-6" />
                      </button>
                      {downloadMenuIndex === index && (
                        <div className="absolute overflow-hidden z-50 mt-9 bg-white dark:bg-neutral-800 shadow-lg rounded-md border border-neutral-200 dark:border-neutral-700">
                          <p className="text-[10px] font-mono p-2 opacity-65">
                            Select the data that you want to download
                          </p>
                          <div className="w-full px-2 flex space-x-1 justify-between items-center border-b border-neutral-300 dark:dark:border-neutral-700 space-y-1 text-xs">
                            <button
                              // minimal={!dwnldOriginalData}
                              onClick={() => setDwnldOriginalData(true)}
                              className={`text-current border px-2 py-1 rounded border-neutral-300 dark:border-neutral-700 cursor-pointer ${
                                dwnldOriginalData
                                  ? "bg-neutral-300 dark:bg-neutral-700"
                                  : ""
                              }`}
                            >
                              Original
                            </button>
                            <button
                              onClick={() => setDwnldOriginalData(false)}
                              className={`text-current border px-2 py-1 rounded border-neutral-300 dark:border-neutral-700 cursor-pointer ${
                                !dwnldOriginalData
                                  ? "bg-neutral-300 dark:bg-neutral-700"
                                  : ""
                              }`}
                            >
                              Shuffled
                            </button>
                          </div>
                          <p className="text-[10px] font-mono px-2 p-2 opacity-65">
                            Select file-type
                          </p>
                          {["JSON", "CSV"].map((format) => (
                            <div
                              key={format}
                              className="px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer text-sm"
                              onClick={() => {
                                handleDownload(
                                  batch_detail,
                                  format.toLowerCase()
                                );
                                setDownloadMenuIndex(null);
                              }}
                            >
                              {format}
                            </div>
                          ))}
                        </div>
                      )}

                      {IsAuthorized(batch_detail) && (
                        <button
                          onClick={() => {
                            handleDelete(batch_detail);
                            setEditFile(null);
                            setEditedAnnotatorId("");
                          }}
                          className="text-red-600 dark:text-red-400 cursor-pointer rounded-md border border-transparent hover:border-current p-1"
                          title="Delete"
                        >
                          <X className="size-6" />
                        </button>
                      )}

                      <button
                        onClick={() => handleShowTasksDetail(batch_detail)}
                        className="text-neutral-800 dark:text-neutral-200 cursor-pointer rounded-md border border-transparent hover:border-current p-1"
                        title="See detail"
                      >
                        <Expand className="size-6" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr key={"no-data"}>
                <td
                  colSpan={10}
                  className="text-center py-6 text-neutral-600 dark:text-neutral-300"
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <svg
                      className="w-10 h-10 text-neutral-400 dark:text-neutral-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 6c0 1.657-3.134 3-7 3S5 7.657 5 6m14 0c0-1.657-3.134-3-7-3S5 4.343 5 6m14 0v6M5 6v6m0 0c0 1.657 3.134 3 7 3s7-1.343 7-3M5 12v6c0 1.657 3.134 3 7 3s7-1.343 7-3v-6"
                      />
                    </svg>
                    <span className="text-lg font-mono">No data available</span>
                    <span className="text-lg font-medium">
                      <a
                        href={evalDataType.sample_batch ?? ""}
                        download={`${evalDataType.value}-sample-eval-batch.json`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        title="Download Sample Dataset"
                      >
                        ⬇ Download{" "}
                      </a>
                      a sample dataset where you can start creating your own for
                      evaluation.
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {loading && (
              <tr
                key={"laoding-popup"}
                className="absolute w-full h-full flex py-6 items-center justify-center top-0 bottom-0 left-0 bg-neutral-200/80 dark:bg-neutral-900/70"
              >
                <td colSpan={10} className="text-center py-6">
                  <svg
                    aria-hidden="true"
                    role="status"
                    className="inline w-10 h-10 me-3 text-blue-500 animate-spin"
                    viewBox="0 0 100 101"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                      fill="#f3f4f6"
                    />
                    <path
                      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                      fill="currentColor"
                    />
                  </svg>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!!activeBatch && (
          <Modal
            isOpen={!!activeBatch}
            setIsOpen={() => setActiveBatch(null)}
            key={1}
            className="!w-full md:!max-w-6xl !px-2"
          >
            <TasksDetail data={activeBatch} />
          </Modal>
        )}
      </div>
    </div>
  );
}
