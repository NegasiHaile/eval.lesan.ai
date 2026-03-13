"use client";
import DatasetsTable, {
  type BulkDeleteToolbarProps,
} from "@/components/tables/DatasetsTable";
import React, { useState, useEffect, useRef } from "react";
import { BatchDetailTypes } from "@/types/data";
import { useUser } from "@/context/UserContext";
import Container from "@/components/utils/Container";
import TabButton from "@/components/utils/TabButton";

import { evalTypes } from "@/constants/others";
import { EvalTypeTypes } from "@/types/others";

import { ChevronDown, Info, Languages, Loader2, Link2, Mic, Plus, RefreshCw, Trash2, Download, UserPen, X } from "lucide-react";
import BatchUploaderForm from "./BatchUploaderForm";
import Modal from "@/components/utils/Modal";
import Button from "@/components/utils/Button";

const Datasets = () => {
  const [batchesDetails, setBatchesDetailTable] = useState<BatchDetailTypes[]>(
    []
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<EvalTypeTypes>(evalTypes[0]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user, isPending } = useUser();

  const [showUploader, setShowUploader] = useState<boolean>(false);
  const [bulkDeleteToolbar, setBulkDeleteToolbar] = useState<BulkDeleteToolbarProps | null>(null);
  const [actOnMenuOpen, setActOnMenuOpen] = useState(false);
  const actOnMenuRef = useRef<HTMLDivElement>(null);
  const [showBulkCreatorModal, setShowBulkCreatorModal] = useState(false);
  const [showBulkEvaluatorModal, setShowBulkEvaluatorModal] = useState(false);
  const [bulkCreatorEmail, setBulkCreatorEmail] = useState("");
  const [bulkEvaluatorEmail, setBulkEvaluatorEmail] = useState("");
  const [showUpdateAudioUrlsModal, setShowUpdateAudioUrlsModal] = useState(false);
  const [updateAudioUrlsResults, setUpdateAudioUrlsResults] = useState<{ file: string; ok: boolean; message: string }[]>([]);
  const [updateAudioUrlsPending, setUpdateAudioUrlsPending] = useState<{ file: File; batchName?: string; error?: string }[]>([]);
  const [updateAudioUrlsDragging, setUpdateAudioUrlsDragging] = useState(false);
  const updateAudioUrlsInputRef = useRef<HTMLInputElement>(null);

  const addUpdateAudioUrlsFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;
    const next: { file: File; batchName?: string; error?: string }[] = [];
    for (const file of fileArray) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { batch_name?: string; tasks?: Array<{ id?: string | number; input?: string }> };
        const batchName = typeof data?.batch_name === "string" ? data.batch_name.trim() : "";
        const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
        if (!batchName) {
          next.push({ file, error: "Missing or invalid batch_name." });
          continue;
        }
        if (tasks.length === 0) {
          next.push({ file, error: "Missing or empty tasks array." });
          continue;
        }
        next.push({ file, batchName });
      } catch (err) {
        next.push({ file, error: err instanceof Error ? err.message : "Invalid JSON or read error." });
      }
    }
    setUpdateAudioUrlsPending((prev) => [...prev, ...next]);
  };

  const removeUpdateAudioUrlsItem = (index: number) => {
    setUpdateAudioUrlsPending((prev) => prev.filter((_, i) => i !== index));
  };

  /** Export batch files metadata for the given batches as JSON or CSV. Counts tasks evaluated and reviewed by fetching each batch at download time. */
  const getLangName = (lang: BatchDetailTypes["source_language"] | undefined) =>
    (lang as { name?: string } | undefined)?.name ?? (lang as { iso_name?: string } | undefined)?.iso_name ?? "";
  const downloadFilesMetadata = async (
    batches: BatchDetailTypes[],
    format: "json" | "csv",
    datasetType: string
  ) => {
    if (!batches.length) return;
    setLoading(true);
    try {
      const rows = await Promise.all(
        batches.map(async (b) => {
          let tasksEvaluated = 0;
          let reviewedTasks = 0;
          try {
            const res = await fetch(`/api/batches/${datasetType}/${b.batch_id}`);
            if (res.ok) {
              const batch = (await res.json()) as { tasks?: Array<{ models?: Array<{ rate?: number; rank?: number }>; reviewer_comment?: string }> };
              const tasks = batch.tasks ?? [];
              tasksEvaluated = tasks.filter(
                (t) =>
                  Array.isArray(t.models) &&
                  t.models.length > 0 &&
                  (t.models[0].rate ?? 0) > 0 &&
                  (t.models[0].rank ?? 0) > 0
              ).length;
              reviewedTasks = tasks.filter(
                (t) => t.reviewer_comment != null && String(t.reviewer_comment).trim() !== ""
              ).length;
            }
          } catch {
            // keep 0 if fetch fails
          }
          const src = getLangName(b.source_language);
          const tgt = getLangName(b.target_language);
          return {
            "Batch/File ID": b.batch_name,
            Language: src && tgt ? `${src} - ${tgt}` : src || tgt || "",
            "Number of tasks": b.number_of_tasks,
            "Tasks evaluated": tasksEvaluated,
            "Reviewed tasks": reviewedTasks,
            "Coodinator/createdby": b.created_by,
            "Contributor/Evaluator ID": (b.assigned_to ?? b.annotator_id) ?? "",
            "Reviewer/QC ID": b.qa_id ?? "",
          };
        })
      );
      const date = new Date().toISOString().slice(0, 10);
      const headers = [
        "Batch/File ID",
        "Language",
        "Number of tasks",
        "Tasks evaluated",
        "Reviewed tasks",
        "Coodinator/createdby",
        "Contributor/Evaluator ID",
        "Reviewer/QC ID",
      ];
      if (format === "json") {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch-files-metadata_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const csvContent = [
          headers.join(","),
          ...rows.map((r) =>
            headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(",")
          ),
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch-files-metadata_${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(false);
      setActOnMenuOpen(false);
    }
  };

  const runUpdateAudioUrls = async () => {
    const valid = updateAudioUrlsPending.filter((p) => p.batchName != null);
    if (!valid.length) return;
    setLoading(true);
    const results: { file: string; ok: boolean; message: string }[] = [];
    for (const { file, batchName } of valid) {
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { batch_name?: string; tasks?: Array<{ id?: string | number; input?: string }> };
        const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
        const payload = {
          batch_name: batchName!,
          tasks: tasks.map((t) => ({ id: t.id, input: typeof t.input === "string" ? t.input : "" })),
        };
        const res = await fetch("/api/batches/asr/update-audio-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          results.push({
            file: file.name,
            ok: true,
            message: body.tasks_updated != null ? `Updated ${body.tasks_updated} task(s).` : "Updated.",
          });
        } else {
          results.push({ file: file.name, ok: false, message: body.message ?? res.statusText });
        }
      } catch (err) {
        results.push({
          file: file.name,
          ok: false,
          message: err instanceof Error ? err.message : "Invalid JSON or read error.",
        });
      }
    }
    setUpdateAudioUrlsResults(results);
    setUpdateAudioUrlsPending((prev) => prev.filter((p) => !p.batchName));
    setLoading(false);
    if (results.some((r) => r.ok)) setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!actOnMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (actOnMenuRef.current && !actOnMenuRef.current.contains(e.target as Node)) {
        setActOnMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actOnMenuOpen]);

  useEffect(() => {
    if (loading) setActOnMenuOpen(false);
  }, [loading]);

  // Restore active tab from localStorage (client-only; avoids SSR "localStorage is not defined")
  useEffect(() => {
    try {
      const stored = localStorage.getItem("active_dataset_tab");
      if (stored) {
        const parsed = JSON.parse(stored) as EvalTypeTypes | null;
        if (parsed && evalTypes.some((t) => t.value === parsed.value))
          setActiveTab(parsed);
      }
    } catch {
      // ignore invalid stored value
    }
  }, []);

  if (isPending) {
    return (
      <Container>
        <div className="w-full flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-8 animate-spin text-neutral-400" />
        </div>
      </Container>
    );
  }

  return (
    <Container className={`${loading ? "cursor-progress" : ""}`}>
        {/* TABS */}
        <div className="w-full flex flex-wrap space-x-2 font-bold">
          {evalTypes.map((tab, i) => {
            return (
              <TabButton
                key={i}
                text={tab.name}
                onClick={() => {
                  localStorage.setItem(
                    "active_dataset_tab",
                    JSON.stringify(tab)
                  );
                  setActiveTab(tab);
                }}
                active={
                  activeTab.value.toLowerCase() === tab.value.toLowerCase()
                }
                className="px-5"
              />
            );
          })}
        </div>

        <Modal
          isOpen={showUploader && user?.role !== "user"}
          setIsOpen={() => setShowUploader(!showUploader)}
          key={1}
          className="!w-full md:!max-w-4xl"
        >
          <BatchUploaderForm
            setBatchesDetailTable={setBatchesDetailTable}
            activeTab={activeTab}
            loading={loading}
            setLoading={setLoading}
            setShowUploader={setShowUploader}
          />
        </Modal>

        <Modal
          isOpen={showBulkCreatorModal}
          setIsOpen={setShowBulkCreatorModal}
          className="!max-w-md"
        >
          <div className="p-2">
            <h3 className="text-lg font-semibold mb-3">Update creator for selected batches</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Enter the new creator email. Only root users can change the creator.
            </p>
            <input
              type="email"
              placeholder="creator@example.com"
              value={bulkCreatorEmail}
              onChange={(e) => setBulkCreatorEmail(e.target.value)}
              className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" minimal size="sm" onClick={() => setShowBulkCreatorModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={loading || !bulkCreatorEmail.trim()}
                onClick={async () => {
                  if (!bulkDeleteToolbar?.onBulkUpdateCreator) return;
                  await bulkDeleteToolbar.onBulkUpdateCreator(bulkCreatorEmail.trim());
                  setShowBulkCreatorModal(false);
                  setBulkCreatorEmail("");
                }}
              >
                Update all selected
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showBulkEvaluatorModal}
          setIsOpen={setShowBulkEvaluatorModal}
          className="!max-w-md"
        >
          <div className="p-2">
            <h3 className="text-lg font-semibold mb-3">Update evaluator for selected batches</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Enter the new evaluator (assigned to) email.
            </p>
            <input
              type="email"
              placeholder="evaluator@example.com"
              value={bulkEvaluatorEmail}
              onChange={(e) => setBulkEvaluatorEmail(e.target.value)}
              className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" minimal size="sm" onClick={() => setShowBulkEvaluatorModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={loading || !bulkEvaluatorEmail.trim()}
                onClick={async () => {
                  if (!bulkDeleteToolbar?.onBulkUpdateEvaluator) return;
                  await bulkDeleteToolbar.onBulkUpdateEvaluator(bulkEvaluatorEmail.trim());
                  setShowBulkEvaluatorModal(false);
                  setBulkEvaluatorEmail("");
                }}
              >
                Update all selected
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showUpdateAudioUrlsModal}
          setIsOpen={setShowUpdateAudioUrlsModal}
          className="!max-w-lg"
        >
          <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold font-mono">Update Audio URLs (ASR)</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Upload the JSON file of the batch that you want to update the audio URLs{" "}
              <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">input</code>. The{" "}
              <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">batch_name</code> in the file must match the batch name in the system. Each file must contain{" "}
              <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">batch_name</code> and a{" "}
              <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">tasks</code> array with <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">id</code> and{" "}
              <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">input</code> per task. Only the <code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded">input</code> field is updated in the database.
            </p>

            <input
              ref={updateAudioUrlsInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) addUpdateAudioUrlsFiles(files);
                e.target.value = "";
              }}
            />

            <div
              onClick={() => !loading && updateAudioUrlsInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setUpdateAudioUrlsDragging(true);
              }}
              onDragLeave={() => setUpdateAudioUrlsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUpdateAudioUrlsDragging(false);
                const files = e.dataTransfer.files;
                if (files?.length) addUpdateAudioUrlsFiles(files);
              }}
              className={`relative border border-dashed rounded-lg p-6 text-center transition cursor-pointer ${
                updateAudioUrlsDragging
                  ? "bg-neutral-300/50 dark:bg-neutral-800/50 border-blue-500"
                  : "border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600"
              } ${loading ? "cursor-not-allowed opacity-70 pointer-events-none" : ""}`}
            >
              {loading ? (
                <p className="text-neutral-600 dark:text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin" />
                  Processing…
                </p>
              ) : (
                <p className="text-neutral-700 dark:text-neutral-300">
                  {updateAudioUrlsDragging
                    ? "Drop file(s) here..."
                    : "Click or drag one or more JSON files to update audio URLs."}
                </p>
              )}
            </div>

            {updateAudioUrlsPending.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Batches that will be updated ({updateAudioUrlsPending.filter((p) => p.batchName).length} valid):
                </p>
                <ul className="text-sm space-y-1.5 max-h-48 overflow-y-auto rounded-md bg-neutral-100 dark:bg-neutral-800/50 p-3 border border-neutral-200 dark:border-neutral-700">
                  {updateAudioUrlsPending.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 py-1 pr-1 rounded hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {item.batchName != null ? (
                          <>
                            <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">{item.batchName}</span>
                            <span className="text-neutral-500 dark:text-neutral-400 text-xs ml-1">({item.file.name})</span>
                          </>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">
                            <span className="font-mono">{item.file.name}</span>: {item.error}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeUpdateAudioUrlsItem(i)}
                        className="shrink-0 p-1 rounded text-neutral-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        title="Remove"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={loading || updateAudioUrlsPending.filter((p) => p.batchName).length === 0}
                    onClick={runUpdateAudioUrls}
                  >
                    {loading ? "Updating…" : "Update"}
                  </Button>
                </div>
              </div>
            )}

            {updateAudioUrlsResults.length > 0 && (
              <ul className="text-sm space-y-1 max-h-48 overflow-y-auto rounded-md bg-neutral-100 dark:bg-neutral-800/50 p-3">
                {updateAudioUrlsResults.map((r, i) => (
                  <li key={i} className={r.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    <span className="font-mono">{r.file}</span>: {r.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                minimal
                size="sm"
                onClick={() => {
                  setUpdateAudioUrlsPending([]);
                  setUpdateAudioUrlsResults([]);
                  setShowUpdateAudioUrlsModal(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>

        <div className="w-full flex flex-col items-center justify-center space-y-5 mt-5">
          {user?.role === "user" && (
            <div className="flex items-center justify-center w-fit gap-3 p-4 rounded-md border border-blue-500 bg-blue-100/50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100">
              <Info className="size-6 text-blue-500 dark:text-blue-400 shrink-0" />
              <p className="text-sm">
                Please ask your Admin for permission if you need to upload a
                dataset for evaluation.
              </p>
            </div>
          )}

          {/* DRAG AND DROP UPLOAD BATCH */}
          {/* {user?.role !== "user" && (
            <NativeDragDrop
              setBatchDetails={setBatchesDetailTable}
              loading={loading}
              setLoading={setLoading}
              datasetType={activeTab}
            />
          )} */}

          <div className="w-full space-y-1 my-5 overflow-x-auto">
            <div className="w-full flex flex-col xl:flex-row gap-2 justify-between items-start">
              <h1 className="text-xl font-semibold mb-3 w-full text-left flex items-center gap-2">
                {activeTab.value === "mt" ? (
                  <Languages className="size-6 shrink-0" />
                ) : activeTab.value === "asr" ? (
                  <Mic className="size-6 shrink-0" />
                ) : null}
                {activeTab.full_name || "Datasets"}
              </h1>

              <div className="flex items-center gap-2">
                <Button
                  className="!w-fit !text-nowrap text-center font-mono"
                  outline={true}
                  minimal
                  size="sm"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  // loading={loading}
                  title={`Refresh ${activeTab.name} datasets`}
                >
                  <RefreshCw className="size-5 shrink-0" />
                  <span className="hidden lg:block">Refresh</span>
                </Button>
                {user?.role !== "user" && (
                  <Button
                    className="!w-fit !text-nowrap text-center font-mono"
                    outline={true}
                    minimal
                    size="sm"
                    disabled={loading}
                    onClick={() => setShowUploader(true)}
                    title={`Upload batch based ${activeTab.name} data for evaluation`}
                  >
                    <Plus className="size-5 shrink-0" />
                    <span className="hidden lg:block">
                      Upload {activeTab.name} tasks
                    </span>
                  </Button>
                )}
                {activeTab.value === "asr" && user?.role !== "user" && (
                  <Button
                    className="!w-fit !text-nowrap text-center font-mono"
                    outline={true}
                    minimal
                    size="sm"
                    disabled={loading}
                    onClick={() => {
                      setShowUpdateAudioUrlsModal(true);
                      setUpdateAudioUrlsResults([]);
                    }}
                    title="Update expired audio URLs in existing ASR batches from JSON files"
                  >
                    <Link2 className="size-5 shrink-0" />
                    <span className="hidden lg:block">Update Audio URLs</span>
                  </Button>
                )}
                {batchesDetails.length > 0 && (
                  <div className="relative" ref={actOnMenuRef}>
                    <Button
                      className="!w-fit !text-nowrap text-center font-mono"
                      variant="primary"
                      minimal
                      size="sm"
                      disabled={loading}
                      onClick={() => setActOnMenuOpen((o) => !o)}
                      title={
                        bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1
                          ? `Act on ${bulkDeleteToolbar.selectedCount} selected`
                          : "Download"
                      }
                    >
                      {bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1 ? (
                        <>
                          <UserPen className="size-5 shrink-0" />
                          <span className="hidden lg:block">
                            Act on ({bulkDeleteToolbar.selectedCount})
                          </span>
                        </>
                      ) : (
                        <>
                          <Download className="size-5 shrink-0" />
                          <span className="hidden lg:block">Download</span>
                        </>
                      )}
                      <ChevronDown className="size-4 shrink-0 ml-0.5" />
                    </Button>
                    {actOnMenuOpen && (
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-1 shadow-lg">
                        {/* Download section */}
                        <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700">
                          Download
                        </div>
                        {bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1 && (
                          <>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                              onClick={() => {
                                bulkDeleteToolbar.onDownloadClick("json");
                                setActOnMenuOpen(false);
                              }}
                            >
                              <Download className="size-4 shrink-0" />
                              {bulkDeleteToolbar.selectedCount} selected files (JSON)
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                              onClick={() => {
                                bulkDeleteToolbar.onDownloadClick("csv");
                                setActOnMenuOpen(false);
                              }}
                            >
                              <Download className="size-4 shrink-0" />
                              {bulkDeleteToolbar.selectedCount} selected files (CSV)
                            </button>
                          </>
                        )}
                        <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 mt-1">
                          Files metadata
                        </div>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                          disabled={loading}
                          onClick={() => {
                            const toExport =
                              bulkDeleteToolbar &&
                              bulkDeleteToolbar.selectedCount >= 1 &&
                              bulkDeleteToolbar.selectedBatchDetails.length > 0
                                ? bulkDeleteToolbar.selectedBatchDetails
                                : batchesDetails;
                            void downloadFilesMetadata(toExport, "json", activeTab.value);
                          }}
                        >
                          <Download className="size-4 shrink-0" />
                          {(bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1
                            ? bulkDeleteToolbar.selectedCount
                            : batchesDetails.length)}{" "}
                          files metadata (JSON)
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                          disabled={loading}
                          onClick={() => {
                            const toExport =
                              bulkDeleteToolbar &&
                              bulkDeleteToolbar.selectedCount >= 1 &&
                              bulkDeleteToolbar.selectedBatchDetails.length > 0
                                ? bulkDeleteToolbar.selectedBatchDetails
                                : batchesDetails;
                            void downloadFilesMetadata(toExport, "csv", activeTab.value);
                          }}
                        >
                          <Download className="size-4 shrink-0" />
                          {(bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1
                            ? bulkDeleteToolbar.selectedCount
                            : batchesDetails.length)}{" "}
                          files metadata (CSV)
                        </button>
                        {/* Update section - when user can update creator (root, multi) and/or evaluator (root, admin, creator) */}
                        {bulkDeleteToolbar &&
                          (bulkDeleteToolbar.showBulkUpdate || bulkDeleteToolbar.showBulkUpdateEvaluator) && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700 mt-1">
                                Update
                              </div>
                              {bulkDeleteToolbar.showBulkUpdateCreator &&
                                bulkDeleteToolbar.selectedCount > 1 &&
                                bulkDeleteToolbar.onBulkUpdateCreator && (
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                    onClick={() => {
                                      setActOnMenuOpen(false);
                                      setBulkCreatorEmail("");
                                      setShowBulkCreatorModal(true);
                                    }}
                                  >
                                    <UserPen className="size-4 shrink-0" />
                                    {bulkDeleteToolbar.selectedCount} selected files creator
                                  </button>
                                )}
                              {bulkDeleteToolbar.showBulkUpdateEvaluator && bulkDeleteToolbar.onBulkUpdateEvaluator && (
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                                  onClick={() => {
                                    setActOnMenuOpen(false);
                                    setBulkEvaluatorEmail("");
                                    setShowBulkEvaluatorModal(true);
                                  }}
                                >
                                  <UserPen className="size-4 shrink-0" />
                                  {bulkDeleteToolbar.selectedCount} selected files evaluator
                                </button>
                              )}
                            </>
                          )}
                      </div>
                    )}
                  </div>
                )}
                {bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1 && (
                  <>
                    {bulkDeleteToolbar.selectedCount > 1 && (
                      <Button
                        className="!w-fit !text-nowrap text-center font-mono"
                        variant="danger"
                        minimal
                        size="sm"
                        disabled={loading}
                        onClick={bulkDeleteToolbar.onOpenConfirm}
                        title="Delete selected batches"
                      >
                        <Trash2 className="size-5 shrink-0" />
                        <span className="hidden lg:block">
                          Delete ({bulkDeleteToolbar.selectedCount})
                        </span>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <DatasetsTable
              batches_details={batchesDetails}
              setBatchDetails={setBatchesDetailTable}
              loading={loading}
              setLoading={setLoading}
              evalDataType={activeTab}
              refreshKey={refreshKey}
              onBulkDeleteToolbarChange={setBulkDeleteToolbar}
              onResetFilters={() => setRefreshKey((k) => k + 1)}
            />
          </div>
        </div>
      </Container>
  );
};

export default Datasets;
