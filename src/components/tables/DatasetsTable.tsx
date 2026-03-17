"use client";
import { useUser } from "@/context/UserContext";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  BatchTasksTypes,
} from "@/types/data";
import { EvalTypeTypes } from "@/types/others";
import { useState, useEffect, Dispatch, useMemo, useCallback } from "react";
import JSZip from "jszip";
import TasksDetail from "./TasksDetail";
import Modal from "../utils/Modal";
import { Download, Expand, RotateCcw, Trash2 } from "lucide-react";
import Button from "../utils/Button";
import SelectTransparent from "../inputs/SelectTransparent";
import TextInput from "../inputs/TextInput";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";

const getProgressColor = (percentage: number): string => {
  if (percentage < 40) return "bg-red-500";
  if (percentage < 70) return "bg-yellow-500";
  return "bg-green-500";
};

/** Progress percentage (0–100) for a batch. */
function getProgressPercent(detail: BatchDetailTypes): number {
  const annotated = parseInt(`${detail.annotated_tasks}`, 10) || 0;
  const total = detail.number_of_tasks || 1;
  return total ? (annotated / total) * 100 : 0;
}

type ProgressFilterValue = "" | "not_started" | "in_progress" | "less_than_50" | "completed_over_50" | "completed" | "not_completed";

const PROGRESS_FILTER_OPTIONS: { value: ProgressFilterValue; label: string }[] = [
  { value: "", label: "All" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "less_than_50", label: "Less than 50%" },
  { value: "completed_over_50", label: "Completed >50%" },
  { value: "completed", label: "Completed (100%)" },
  { value: "not_completed", label: "Not 100% completed" },
];

function progressMatchesFilter(percent: number, filter: ProgressFilterValue): boolean {
  if (!filter) return true;
  switch (filter) {
    case "not_started":
      return percent === 0;
    case "in_progress":
      return percent > 0 && percent < 100;
    case "less_than_50":
      return percent > 0 && percent < 50;
    case "completed_over_50":
      return percent >= 50 && percent < 100;
    case "completed":
      return percent === 100;
    case "not_completed":
      return percent < 100;
    default:
      return true;
  }
}

/** Escape a CSV field (quote if needed, double internal quotes). */
function escapeCSV(value: string): string {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Optional batch metadata to include in CSV export. */
type BatchExportMeta = {
  created_by?: string;
  annotator_id?: string | null;
  qa_id?: string | null;
};

/** Convert batch (MT or ASR) to CSV: one row per (task, model). Columns: task_id, input, output, model, domain, rate, rank, reference, plus creator/annotator/reviewer when meta provided. */
function batchToCSV(
  batch: ASRBatchTasksTypes | BatchTasksTypes,
  meta?: BatchExportMeta
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
    ...(meta ? ["creator", "annotator", "reviewer"] : []),
  ];
  const rows: string[][] = [headers];

  const creator = meta?.created_by ?? "";
  const annotator = meta?.annotator_id ?? "";
  const reviewer = meta?.qa_id ?? "";

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
        ...(meta ? [creator, annotator, reviewer] : []),
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
}

export type BulkDeleteToolbarProps = {
  selectedCount: number;
  /** Batch details for the currently selected rows (for export / Files metadata). */
  selectedBatchDetails: BatchDetailTypes[];
  onOpenConfirm: () => void;
  onDownloadClick: (format: "json" | "csv") => void;
  /** Bulk update creator for all selected batches (root only). */
  onBulkUpdateCreator?: (newCreatorEmail: string) => Promise<void>;
  /** Bulk update evaluator (annotator) for all selected batches. */
  onBulkUpdateEvaluator?: (newEvaluatorEmail: string) => Promise<void>;
  /** True when Update all dropdown should be shown: root, admin, or creator of every selected batch (multiple only). */
  showBulkUpdate?: boolean;
  /** True when user can bulk-update creator (root only). */
  showBulkUpdateCreator?: boolean;
  /** True when user can bulk-update evaluator: root, admin, or creator of selected batch(es). Shown for 1+ selected. */
  showBulkUpdateEvaluator?: boolean;
};

type DatasetsTableProps = {
  batches_details: BatchDetailTypes[];
  setBatchDetails: Dispatch<React.SetStateAction<BatchDetailTypes[]>>;
  loading: boolean;
  setLoading: Dispatch<React.SetStateAction<boolean>>;
  evalDataType: EvalTypeTypes;
  /** Increment to trigger a refetch (e.g. from Refresh button). */
  refreshKey?: number;
  /** Called when selection changes so parent can show Delete selected button (e.g. next to Refresh/Upload). */
  onBulkDeleteToolbarChange?: (props: BulkDeleteToolbarProps | null) => void;
  /** Called when Reset filter is clicked; parent can trigger data refetch. */
  onResetFilters?: () => void;
};

export default function DatasetsTable({
  batches_details,
  setBatchDetails,
  loading,
  setLoading,
  evalDataType,
  refreshKey = 0,
  onBulkDeleteToolbarChange,
  onResetFilters,
}: DatasetsTableProps) {
  // TODO: add filter feature across the table by each of the column names
  const { user } = useUser();
  const [editFile, setEditFile] = useState<number | null>(null);
  const [editCreatorIndex, setEditCreatorIndex] = useState<number | null>(null);
  const [editedCreatedBy, setEditedCreatedBy] = useState<string>("");
  const [activeBatch, setActiveBatch] = useState<
    ASRBatchTasksTypes | BatchTasksTypes | null
  >(null);
  const [editedAnnotatorId, setEditedAnnotatorId] = useState<string | number>(
    ""
  );
  const [editReviewerFile, setEditReviewerFile] = useState<number | null>(null);
  const [editedReviewerId, setEditedReviewerId] = useState<string>("");
  const initialFilters = {
    batch_name: "",
    dataset_domain: "",
    source_language: "",
    target_language: "",
    models: "",
    created_by: "",
    annotator_id: "",
    qa_id: "",
    progress_filter: "" as ProgressFilterValue,
  };
  const [filters, setFilters] = useState(initialFilters);

  const handleResetFilters = useCallback(() => {
    setFilters(initialFilters);
    onResetFilters?.();
  }, [onResetFilters]);
  const [downloadMenuIndex, setDownloadMenuIndex] = useState<number | null>(
    null
  );
  const [dwnldOriginalData, setDwnldOriginalData] = useState<boolean>(true);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const annotatorUsernames = useMemo(
    () => [...new Set(batches_details.map((b) => b.annotator_id).filter(Boolean) as string[])],
    [batches_details]
  );
  const presenceStatuses = usePresenceStatus(annotatorUsernames);
  const hasActiveAnnotator = useMemo(
    () => Object.values(presenceStatuses).some((p) => p.status === "active"),
    [presenceStatuses]
  );

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

  // Auto-refresh batch details every 60s while any annotator is active
  useEffect(() => {
    if (!user?.username || !hasActiveAnnotator) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/batches-details?username=${user.username}&dataset_type=${evalDataType.value}`
        );
        if (res.ok) {
          const data: BatchDetailTypes[] = await res.json();
          setBatchDetails(data);
        }
      } catch {
        // ignore
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [user?.username, evalDataType.value, hasActiveAnnotator, setBatchDetails]);

  useEffect(() => {
    setSelectedBatchIds(new Set());
  }, [evalDataType.value]);

  /** Fetch one batch and return its blob + filename (no download). */
  const getBatchBlob = useCallback(
    async (
      batch_detail: BatchDetailTypes,
      format: string
    ): Promise<{ blob: Blob; filename: string }> => {
      const res = await fetch(
        `/api/batches/${evalDataType.value}/${batch_detail.batch_id}?include_models_shuffles=true`
      );
      if (!res.ok) throw new Error("Failed to fetch batch data from server.");
      const batch = await res.json();

      if (dwnldOriginalData && !!batch.task_models_shuffles) {
        for (const task of batch.tasks) {
          const shuffleMap = batch.task_models_shuffles?.[task.id];
          for (const model of task.models) {
            model.model = shuffleMap?.[model.model] ?? model.model;
          }
        }
        delete batch.task_models_shuffles;
      }

      const isCSV = format === "csv";
      let blob: Blob;
      let filename: string;
      const exportMeta: BatchExportMeta = {
        created_by: batch_detail.created_by,
        annotator_id: batch_detail.annotator_id,
        qa_id: batch_detail.qa_id,
      };
      if (isCSV) {
        blob = new Blob([batchToCSV(batch, exportMeta)], { type: "text/csv;charset=utf-8" });
        filename = `${batch_detail.batch_name}_${batch_detail.batch_id}_batch_tasks.csv`;
      } else {
        const batchWithDomains = {
          ...batch,
          domains: batch_detail.domains ?? batch.domains ?? [],
          created_by: batch_detail.created_by,
          annotator_id: batch_detail.annotator_id ?? undefined,
          qa_id: batch_detail.qa_id ?? undefined,
        };
        blob = new Blob([JSON.stringify(batchWithDomains, null, 2)], {
          type: "application/json",
        });
        filename = `${batch_detail.batch_name}_${batch_detail.batch_id}_batch_tasks.json`;
      }
      return { blob, filename };
    },
    [evalDataType.value, dwnldOriginalData]
  );

  /** Single-batch download: fetch, build blob, trigger save. Does not set loading. */
  const doOneDownload = useCallback(
    async (batch_detail: BatchDetailTypes, format: string) => {
      const { blob, filename } = await getBatchBlob(batch_detail, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [getBatchBlob]
  );

  const handleDownload = async (
    batch_detail: BatchDetailTypes,
    format: string
  ) => {
    setLoading(true);
    try {
      await doOneDownload(batch_detail, format);
    } catch (error) {
      console.error("Download error:", error);
      alert("Could not download the batch tasks.");
    } finally {
      setLoading(false);
    }
  };

  /** Performs DELETE API call and clears localStorage for the batch. Does not update table state. Returns true if deleted. */
  const doDeleteBatch = useCallback(
    async (batch_detail: BatchDetailTypes): Promise<boolean> => {
      const batch_id = batch_detail.batch_id;
      const res = await fetch(`/api/batches/${batch_detail.dataset_type}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...batch_detail }),
      });
      if (!res.ok) return false;
      if (batch_detail.dataset_type === "mt") {
        const actv_batch = JSON.parse(localStorage.getItem("active_batch") || "{}");
        if (actv_batch?.batch_id === batch_id) localStorage.removeItem("active_batch");
      } else if (batch_detail.dataset_type === "asr") {
        const asr_actv_batch = JSON.parse(localStorage.getItem("asr_active_batch") || "{}");
        if (asr_actv_batch?.batch_id === batch_id) localStorage.removeItem("asr_active_batch");
      }
      return true;
    },
    []
  );

  /** Bulk update creator for all selected batches. Uses existing PATCH API; root-only. */
  const bulkUpdateCreator = useCallback(
    async (newCreatorEmail: string) => {
      const email = `${newCreatorEmail}`.trim();
      if (!email) {
        alert("Please enter a creator email.");
        return;
      }
      const toUpdate = batches_details.filter((b) => selectedBatchIds.has(b.batch_id));
      if (toUpdate.length === 0) return;
      setLoading(true);
      let succeeded = 0;
      let failed = 0;
      try {
        for (const batch of toUpdate) {
          try {
            const res = await fetch(`/api/batches-details/${batch.batch_id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ created_by: email }),
            });
            if (res.ok) {
              succeeded++;
              setBatchDetails((prev) =>
                prev.map((d) =>
                  d.batch_id === batch.batch_id ? { ...d, created_by: email } : d
                )
              );
            } else {
              failed++;
              const err = await res.json().catch(() => null);
              console.warn(`Batch ${batch.batch_name}: ${err?.message ?? res.statusText}`);
            }
          } catch {
            failed++;
          }
        }
        if (succeeded > 0) setSelectedBatchIds(new Set());
        if (failed > 0) alert(`Updated ${succeeded} batch(es). ${failed} failed (check console).`);
        else if (succeeded > 0) alert(`Creator updated for ${succeeded} batch(es).`);
      } finally {
        setLoading(false);
      }
    },
    [batches_details, selectedBatchIds, setBatchDetails]
  );

  /** Bulk update evaluator (annotator) for all selected batches. Uses existing PATCH API. */
  const bulkUpdateEvaluator = useCallback(
    async (newEvaluatorEmail: string) => {
      const email = `${newEvaluatorEmail}`.trim();
      if (!email) {
        alert("Please enter an evaluator email.");
        return;
      }
      const toUpdate = batches_details.filter((b) => selectedBatchIds.has(b.batch_id));
      if (toUpdate.length === 0) return;
      setLoading(true);
      let succeeded = 0;
      let failed = 0;
      try {
        for (const batch of toUpdate) {
          try {
            const res = await fetch(`/api/batches-details/${batch.batch_id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ annotator_id: email }),
            });
            if (res.ok) {
              succeeded++;
              setBatchDetails((prev) =>
                prev.map((d) =>
                  d.batch_id === batch.batch_id ? { ...d, annotator_id: email } : d
                )
              );
            } else {
              failed++;
              const err = await res.json().catch(() => null);
              console.warn(`Batch ${batch.batch_name}: ${err?.message ?? res.statusText}`);
            }
          } catch {
            failed++;
          }
        }
        if (succeeded > 0) setSelectedBatchIds(new Set());
        if (failed > 0) alert(`Updated ${succeeded} batch(es). ${failed} failed (check console).`);
        else if (succeeded > 0) alert(`Evaluator updated for ${succeeded} batch(es).`);
      } finally {
        setLoading(false);
      }
    },
    [batches_details, selectedBatchIds, setBatchDetails]
  );

  useEffect(() => {
    if (!onBulkDeleteToolbarChange) return;
    if (selectedBatchIds.size >= 1) {
      const isRootRole = user?.role?.toLowerCase() === "root";
      const isAdmin = user?.role?.toLowerCase() === "admin";
      const selectedDetails = batches_details.filter((b) => selectedBatchIds.has(b.batch_id));
      const isCreatorOfAll =
        selectedDetails.length > 0 &&
        selectedDetails.every(
          (b) => (b.created_by ?? "").toLowerCase() === (user?.username ?? "").toLowerCase()
        );
      const showBulkUpdate =
        selectedDetails.length > 1 && (isRootRole || isAdmin || isCreatorOfAll);
      const showBulkUpdateEvaluator =
        selectedDetails.length >= 1 && (isRootRole || isAdmin || isCreatorOfAll);

      onBulkDeleteToolbarChange({
        selectedCount: selectedBatchIds.size,
        selectedBatchDetails: selectedDetails,
        onOpenConfirm: () => setShowBulkDeleteConfirm(true),
        onBulkUpdateCreator: isRootRole ? bulkUpdateCreator : undefined,
        onBulkUpdateEvaluator: showBulkUpdateEvaluator ? bulkUpdateEvaluator : undefined,
        showBulkUpdate,
        showBulkUpdateCreator: isRootRole,
        showBulkUpdateEvaluator,
        onDownloadClick: async (format: "json" | "csv") => {
          const toDownload = batches_details.filter((b) =>
            selectedBatchIds.has(b.batch_id)
          );
          setLoading(true);
          try {
            if (toDownload.length === 1) {
              await doOneDownload(toDownload[0], format);
            } else {
              const zip = new JSZip();
              for (const d of toDownload) {
                const { blob, filename } = await getBatchBlob(d, format);
                zip.file(filename, blob);
              }
              const zipBlob = await zip.generateAsync({ type: "blob" });
              const url = URL.createObjectURL(zipBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `batches_${new Date().toISOString().slice(0, 10)}.zip`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }
            setSelectedBatchIds(new Set());
          } catch (err) {
            console.error("Bulk download error:", err);
            alert("Some downloads failed.");
          } finally {
            setLoading(false);
          }
        },
      });
    } else {
      onBulkDeleteToolbarChange(null);
    }
  }, [
    selectedBatchIds,
    onBulkDeleteToolbarChange,
    batches_details,
    user?.role,
    user?.username,
    doOneDownload,
    getBatchBlob,
    bulkUpdateCreator,
    bulkUpdateEvaluator,
  ]);

  const handleDelete = async (batch_detail: BatchDetailTypes) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this batch? This action cannot be undone."
    );
    if (!confirmed) return;
    setLoading(true);
    const ok = await doDeleteBatch(batch_detail);
    setLoading(false);
    if (!ok) {
      alert("Deleting batch failed!");
      return;
    }
    setBatchDetails((prev) => prev.filter((t) => t.batch_id !== batch_detail.batch_id));
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

  const handleAssignReviewer = async (batch_detail: BatchDetailTypes) => {
    const reviewer_email = editedReviewerId.trim() || null;

    if ((batch_detail.qa_id ?? "").trim().toLowerCase() === (reviewer_email ?? "").toLowerCase()) {
      setEditReviewerFile(null);
      setEditedReviewerId("");
      return;
    }

    if (!user?.email && !user?.username) {
      alert("Unauthorized user or your session has expired. Please sign in again.");
      setEditReviewerFile(null);
      return;
    }

    setLoading(true);
    try {
      const batchID = batch_detail?.batch_id;
      const res = await fetch(`/api/batches-details/${batchID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qa_id: reviewer_email }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to assign reviewer.");
      }

      const updatedDetails = batches_details.map((detail) =>
        detail.batch_id === batchID
          ? { ...detail, qa_id: reviewer_email }
          : detail
      ) as BatchDetailTypes[];
      setBatchDetails(updatedDetails);
      setEditReviewerFile(null);
      setEditedReviewerId("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to assign reviewer.");
    } finally {
      setLoading(false);
    }
  };

  const IsAuthorized = (batch_detail: BatchDetailTypes) => {
    return batch_detail.created_by === user?.username;
  };

  const isRoot = user?.role?.toLowerCase() === "root";
  const isAdminOrRoot = ["root", "admin"].includes(user?.role?.toLowerCase() ?? "");

  const handleAssignCreator = async (batch_detail: BatchDetailTypes) => {
    const creator_email = `${editedCreatedBy}`.trim() ?? null;

    if ((batch_detail.created_by ?? "").trim().toLowerCase() === (creator_email ?? "").toLowerCase()) {
      setEditCreatorIndex(null);
      setEditedCreatedBy("");
      return;
    }

    if (!user?.email && !user?.username) {
      alert("Unauthorized user or your session has expired. Please sign in again.");
      setEditCreatorIndex(null);
      return;
    }

    setLoading(true);
    try {
      const batchID = batch_detail?.batch_id;
      const res = await fetch(`/api/batches-details/${batchID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_by: creator_email }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message ?? "Failed to update batch creator.");
      }

      const updatedDetails = batches_details.map((detail) =>
        detail.batch_id === batchID
          ? { ...detail, created_by: creator_email ?? "" }
          : detail
      ) as BatchDetailTypes[];
      setBatchDetails(updatedDetails);
      setEditCreatorIndex(null);
      setEditedCreatedBy("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update creator.");
    } finally {
      setLoading(false);
    }
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

  const matchesOtherFilters = useCallback(
    (detail: BatchDetailTypes) =>
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
        .includes(filters.annotator_id.toLowerCase()) &&
      (detail.qa_id ?? "")
        .toString()
        .toLowerCase()
        .includes(filters.qa_id.toLowerCase()),
    [
      filters.batch_name,
      filters.dataset_domain,
      filters.source_language,
      filters.target_language,
      filters.models,
      filters.created_by,
      filters.annotator_id,
      filters.qa_id,
    ]
  );

  const filteredBatches = batches_details.filter((detail) => {
    const percent = getProgressPercent(detail);
    const progressMatch = progressMatchesFilter(percent, filters.progress_filter);
    return progressMatch && matchesOtherFilters(detail);
  });

  const progressCounts = useMemo(() => {
    const matching = batches_details.filter(matchesOtherFilters);
    const counts: Record<string, number> = {};
    for (const opt of PROGRESS_FILTER_OPTIONS) {
      if (opt.value === "") {
        counts[""] = matching.length;
      } else {
        counts[opt.value] = matching.filter((d) =>
          progressMatchesFilter(getProgressPercent(d), opt.value as ProgressFilterValue)
        ).length;
      }
    }
    return counts;
  }, [batches_details, matchesOtherFilters]);

  const filterFields = [
    { key: "batch_name", placeholder: "Filter by name" },
    { key: "dataset_domain", placeholder: "Filter by domain" },
    {
      key: "language_pair",
      type: "dual",
      placeholders: ["From", "To"],
    },
    { key: "models", placeholder: "Model" },
    { key: "", type: "spacer" },
    { key: "created_by", placeholder: "Creator" },
    { type: "assigned_and_progress" },
    { key: "qa_id", placeholder: "Reviewer" },
  ];

  const canDelete = useCallback(
    (batch_detail: BatchDetailTypes) =>
      batch_detail.created_by === user?.username || user?.role?.toLowerCase() === "root",
    [user?.username, user?.role]
  );

  const deletableBatches = useMemo(
    () => filteredBatches.filter((b) => canDelete(b)),
    [filteredBatches, canDelete]
  );

  const toggleSelection = (batchId: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const deletableIds = deletableBatches.map((b) => b.batch_id);
    const allSelected =
      deletableIds.length > 0 && deletableIds.every((id) => selectedBatchIds.has(id));
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (allSelected) deletableIds.forEach((id) => next.delete(id));
      else deletableIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBulkDeleteConfirm = async () => {
    const toDelete = batches_details.filter(
      (b) => selectedBatchIds.has(b.batch_id) && canDelete(b)
    );
    if (toDelete.length === 0) {
      setShowBulkDeleteConfirm(false);
      return;
    }
    setLoading(true);
    const succeeded = new Set<string>();
    for (const d of toDelete) {
      const ok = await doDeleteBatch(d);
      if (ok) succeeded.add(d.batch_id);
    }
    setBatchDetails((prev) => prev.filter((b) => !succeeded.has(b.batch_id)));
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });
    setShowBulkDeleteConfirm(false);
    setLoading(false);
    alert(
      succeeded.size === toDelete.length
        ? `${succeeded.size} batch(es) deleted.`
        : `${succeeded.size} of ${toDelete.length} deleted; some failed.`
    );
  };

  const selectedDeletableDetails = useMemo(
    () =>
      batches_details.filter(
        (b) => selectedBatchIds.has(b.batch_id) && canDelete(b)
      ),
    [batches_details, selectedBatchIds, canDelete]
  );

  return (
    <div className="relative min-h-[55lvh]">
      <div className="overflow-x-auto border-1 rounded-md border-neutral-300 dark:border-neutral-800 bg-neutral-200/30 dark:bg-neutral-800/30">
        <table className="min-w-full px-2 py-4 text-left border-spacing-y-2">
          <colgroup>
            <col className="w-10" />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col style={{ width: "1%" }} />
          </colgroup>
          <thead className="border-b-1 rounded-3xl font-mono border-neutral-300 dark:border-neutral-800 py-5">
            <tr>
              <th className="px-2 py-4 text-left w-10">
                {deletableBatches.length > 0 ? (
                  <input
                    type="checkbox"
                    checked={
                      deletableBatches.length > 0 &&
                      deletableBatches.every((b) =>
                        selectedBatchIds.has(b.batch_id)
                      )
                    }
                    onChange={toggleSelectAll}
                    title="Select all (deletable batches)"
                    className="w-5 h-5 min-w-5 min-h-5 rounded border-neutral-300 dark:border-neutral-600 cursor-pointer"
                  />
                ) : null}
              </th>
              <th className="px-4 py-4 text-left">#</th>
              <th className="px-4 py-4 text-left">Dataset</th>
              <th className="px-4 py-4 text-left">Domain</th>
              <th className="px-4 py-4 text-left">From-To</th>
              <th className="px-4 py-4 text-left">Models</th>
              <th className="px-4 py-4 text-left">Created_At</th>
              <th className="px-4 py-4 text-left">Created_BY</th>
              <th className="px-4 py-4 text-left">Evaluator_ID</th>
              <th className="px-4 py-4 text-left">Reviewer</th>
              <th className="px-2 py-4 text-left whitespace-nowrap">Actions</th>
            </tr>
            <tr className="bg-neutral-100 dark:bg-neutral-900 text-xs">
              <th />
              <th> {/* Serial column */} </th>
              {filterFields.map((field, idx) => {
                if (field.type === "spacer") return <th key={idx} />;
                if (field.type === "dual") {
                  return (
                    <th key={idx}>
                      <div className="flex gap-1 w-full">
                        <TextInput
                          type="text"
                          name="source_language"
                          value={filters.source_language}
                          placeholder={field.placeholders?.[0] ?? "From"}
                          onChange={(e) =>
                            handleFilterChange("source_language", e.target.value)
                          }
                          size="xs"
                          className="flex-1 min-w-0"
                        />
                        <TextInput
                          type="text"
                          name="target_language"
                          value={filters.target_language}
                          placeholder={field.placeholders?.[1] ?? "To"}
                          onChange={(e) =>
                            handleFilterChange("target_language", e.target.value)
                          }
                          size="xs"
                          className="flex-1 min-w-0"
                        />
                      </div>
                    </th>
                  );
                }
                if (field.type === "assigned_and_progress") {
                  return (
                    <th key={idx} className="min-w-[220px]">
                      <div className="flex flex-col sm:flex-row gap-2 w-full p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                        <TextInput
                          type="text"
                          name="annotator_id"
                          value={filters.annotator_id}
                          placeholder="Evaluator (email)"
                          onChange={(e) =>
                            handleFilterChange("annotator_id", e.target.value)
                          }
                          size="xs"
                          className="flex-1 min-w-0 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <SelectTransparent
                          name="progress_filter"
                          value={filters.progress_filter}
                          optionsValues={PROGRESS_FILTER_OPTIONS.map((o) => o.value)}
                          optionsLabels={PROGRESS_FILTER_OPTIONS.map(
                            (o) => `${o.label} (${progressCounts[o.value] ?? 0})`
                          )}
                          onChange={(e) =>
                            handleFilterChange(
                              "progress_filter",
                              (e.target.value as ProgressFilterValue) || ""
                            )
                          }
                          variant="outlined"
                          className="flex-1 min-w-0"
                          selectClass="!px-2 !py-1.5 !h-auto !w-full text-xs min-w-0 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                        />
                      </div>
                    </th>
                  );
                }
                if (!field.key) return <th key={idx} />;
                return (
                  <th key={idx}>
                    <TextInput
                      type="text"
                      name={field.key}
                      value={filters[field.key as keyof typeof filters]}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        handleFilterChange(field.key, e.target.value)
                      }
                      size="xs"
                      className="w-full"
                    />
                  </th>
                );
              })}
              <th className="px-2 py-1 align-middle text-left">
                <Button
                  type="button"
                  variant="secondary"
                  minimal
                  size="sm"
                  disabled={loading}
                  onClick={handleResetFilters}
                  className="!text-xs whitespace-nowrap"
                  title="Reset all filters and refresh data"
                >
                  <RotateCcw className="size-3.5 shrink-0" />
                  Reset filter
                </Button>
              </th>
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
                    className="border-t border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="px-2 py-2 w-10 align-middle">
                      {canDelete(batch_detail) ? (
                        <input
                          type="checkbox"
                          checked={selectedBatchIds.has(batch_detail.batch_id)}
                          onChange={() => toggleSelection(batch_detail.batch_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 min-w-5 min-h-5 rounded border-neutral-300 dark:border-neutral-600 cursor-pointer"
                        />
                      ) : null}
                    </td>
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
                    <td className="px-3 py-2 text-sm font-mono" title={batch_detail.created_by}>
                      {editCreatorIndex !== index ? (
                        <>
                          {(batch_detail.created_by ?? "").length > 15
                            ? `${(batch_detail.created_by ?? "").slice(0, 15)}...`
                            : batch_detail.created_by ?? ""}
                          {isRoot && (
                            <span
                              className="ml-1 p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                              onClick={() => {
                                setEditCreatorIndex(index);
                                setEditedCreatedBy(batch_detail.created_by ?? "");
                              }}
                              title="Edit coordinator"
                            >
                              ✏️
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1">
                          <input
                            name={`creator_${index}`}
                            value={editedCreatedBy}
                            onChange={(e) => setEditedCreatedBy(e.target.value)}
                            type="text"
                            placeholder="Coordinator email"
                            className="border rounded p-[2px] focus:outline-none w-full max-w-[180px]"
                          />
                          <span
                            className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            onClick={() => handleAssignCreator(batch_detail)}
                            title="Save"
                          >
                            ✔
                          </span>
                          <span
                            className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            onClick={() => {
                              setEditCreatorIndex(null);
                              setEditedCreatedBy("");
                            }}
                            title="Cancel"
                          >
                            ✖
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm font-mono">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex justify-between items-center gap-1">
                          {editFile !== index && (
                            <span
                              onDoubleClick={() => {
                                setEditFile(index);
                                setEditedAnnotatorId(
                                  batch_detail.annotator_id ?? ""
                                );
                              }}
                              className="truncate"
                            >
                              {batch_detail.annotator_id && (() => {
                                const p = presenceStatuses[batch_detail.annotator_id];
                                const isOnThisBatch =
                                  p?.status === "active" &&
                                  p?.batch_id === batch_detail.batch_id;
                                const isIdle =
                                  p?.status === "idle" ||
                                  (p?.status === "active" &&
                                    p?.batch_id !== batch_detail.batch_id);
                                return (
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                      isOnThisBatch
                                        ? "bg-green-500"
                                        : isIdle
                                        ? "bg-yellow-500"
                                        : "bg-gray-400"
                                    }`}
                                    title={
                                      isOnThisBatch
                                        ? "active"
                                        : isIdle
                                        ? "idle"
                                        : "away"
                                    }
                                  />
                                );
                              })()}
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
                              className="border rounded p-[2px] focus:outline-none w-full min-w-0"
                            />
                          )}
                          {IsAuthorized(batch_detail) && (
                            <div className="shrink-0 flex items-center gap-0.5">
                              {(editFile === null || editFile !== index) && (
                                <span
                                  className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                  onClick={() => {
                                    setEditFile(index);
                                    setEditedAnnotatorId(
                                      batch_detail.annotator_id ?? ""
                                    );
                                  }}
                                  title="Edit evaluator"
                                >
                                  ✏️
                                </span>
                              )}
                              {editFile === index && (
                                <>
                                  <span
                                    className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    onClick={() => {
                                      handleAssignAnnotator(batch_detail);
                                    }}
                                    title="Save"
                                  >
                                    ✔
                                  </span>
                                  <span
                                    className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                    onClick={() => {
                                      setEditFile(null);
                                      setEditedAnnotatorId("");
                                    }}
                                    title="Cancel"
                                  >
                                    ✖
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="w-full">
                          <div className="w-full bg-neutral-200 dark:bg-neutral-600 h-3 rounded-full overflow-hidden">
                            <div
                              className={`h-3 rounded-full ${progressColor}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-mono">
                            {annotatedItems}/{batch_detail.number_of_tasks}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono" title={batch_detail.qa_id ?? ""}>
                      {editReviewerFile !== index ? (
                        <>
                          {(batch_detail.qa_id ?? "").length > 15
                            ? `${(batch_detail.qa_id ?? "").slice(0, 15)}...`
                            : batch_detail.qa_id ?? "N/A"}
                          {isAdminOrRoot && (
                            <span
                              className="ml-1 p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                              onClick={() => {
                                setEditReviewerFile(index);
                                setEditedReviewerId(batch_detail.qa_id ?? "");
                              }}
                              title="Edit reviewer"
                            >
                              ✏️
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1">
                          <input
                            name={`reviewer_${index}`}
                            value={editedReviewerId}
                            onChange={(e) => setEditedReviewerId(e.target.value)}
                            type="text"
                            placeholder="Reviewer email"
                            className="border rounded p-[2px] focus:outline-none w-full max-w-[180px]"
                          />
                          <span
                            className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            onClick={() => handleAssignReviewer(batch_detail)}
                            title="Save"
                          >
                            ✔
                          </span>
                          <span
                            className="p-1 rounded cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            onClick={() => {
                              setEditReviewerFile(null);
                              setEditedReviewerId("");
                            }}
                            title="Cancel"
                          >
                            ✖
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 flex justify-start items-center gap-2 whitespace-nowrap">
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

                      {(IsAuthorized(batch_detail) || isRoot) && (
                        <button
                          onClick={() => {
                            handleDelete(batch_detail);
                            setEditFile(null);
                            setEditCreatorIndex(null);
                            setEditedAnnotatorId("");
                            setEditedCreatedBy("");
                          }}
                          className="text-red-600 dark:text-red-400 cursor-pointer rounded-md border border-transparent hover:border-current p-1"
                          title="Delete"
                        >
                          <Trash2 className="size-6" />
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
                  colSpan={12}
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
                <td colSpan={12} className="text-center py-6">
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

        {showBulkDeleteConfirm && (
          <Modal
            isOpen={showBulkDeleteConfirm}
            setIsOpen={setShowBulkDeleteConfirm}
            className="!max-w-md"
          >
            <div className="p-4 space-y-4">
              <h3 className="text-lg font-semibold font-mono">
                Delete {selectedDeletableDetails.length} batch(es)?
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                This action cannot be undone. The following batches will be deleted:
              </p>
              <ul className="max-h-48 overflow-y-auto list-disc list-inside text-sm font-mono space-y-1">
                {selectedDeletableDetails.map((b) => (
                  <li key={b.batch_id}>{b.batch_name ?? b.batch_id}</li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="primary"
                  minimal
                  onClick={() => setShowBulkDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleBulkDeleteConfirm}
                  loading={loading}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
