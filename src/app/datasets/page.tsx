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

import { ChevronDown, Info, Languages, Loader2, Mic, Plus, RefreshCw, Trash2, Download, UserPen } from "lucide-react";
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
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [updateAllMenuOpen, setUpdateAllMenuOpen] = useState(false);
  const updateAllMenuRef = useRef<HTMLDivElement>(null);
  const [showBulkCreatorModal, setShowBulkCreatorModal] = useState(false);
  const [showBulkEvaluatorModal, setShowBulkEvaluatorModal] = useState(false);
  const [bulkCreatorEmail, setBulkCreatorEmail] = useState("");
  const [bulkEvaluatorEmail, setBulkEvaluatorEmail] = useState("");

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [downloadMenuOpen]);

  useEffect(() => {
    if (loading) setDownloadMenuOpen(false);
  }, [loading]);
  useEffect(() => {
    if (!updateAllMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (updateAllMenuRef.current && !updateAllMenuRef.current.contains(e.target as Node)) {
        setUpdateAllMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [updateAllMenuOpen]);

  useEffect(() => {
    if (loading) setUpdateAllMenuOpen(false);
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
                {bulkDeleteToolbar && bulkDeleteToolbar.selectedCount >= 1 && (
                  <>
                    <div className="relative" ref={downloadMenuRef}>
                      <Button
                        className="!w-fit !text-nowrap text-center font-mono"
                        variant="primary"
                        minimal
                        size="sm"
                        disabled={loading}
                        onClick={() => setDownloadMenuOpen((o) => !o)}
                        title="Download selected batches"
                      >
                        <Download className="size-5 shrink-0" />
                        <span className="hidden lg:block">
                          Download ({bulkDeleteToolbar.selectedCount})
                        </span>
                      </Button>
                      {downloadMenuOpen && (
                        <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-1 shadow-lg">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            onClick={() => {
                              bulkDeleteToolbar.onDownloadClick("json");
                              setDownloadMenuOpen(false);
                            }}
                          >
                            JSON
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            onClick={() => {
                              bulkDeleteToolbar.onDownloadClick("csv");
                              setDownloadMenuOpen(false);
                            }}
                          >
                            CSV
                          </button>
                        </div>
                      )}
                    </div>
                    {bulkDeleteToolbar.selectedCount > 1 && bulkDeleteToolbar.showBulkUpdate && (
                      <div className="relative" ref={updateAllMenuRef}>
                        <Button
                          className="!w-fit !text-nowrap text-center font-mono"
                          variant="primary"
                          minimal
                          size="sm"
                          disabled={loading}
                          onClick={() => setUpdateAllMenuOpen((o) => !o)}
                          title="Update creator or evaluator for selected batches"
                        >
                          <UserPen className="size-5 shrink-0" />
                          <span className="hidden lg:block">Update ({bulkDeleteToolbar.selectedCount})</span>
                          <ChevronDown className="size-4 shrink-0 ml-0.5" />
                        </Button>
                        {updateAllMenuOpen && (
                          <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-1 shadow-lg">
                            {bulkDeleteToolbar.showBulkUpdateCreator && bulkDeleteToolbar.onBulkUpdateCreator && (
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                onClick={() => {
                                  setUpdateAllMenuOpen(false);
                                  setBulkCreatorEmail("");
                                  setShowBulkCreatorModal(true);
                                }}
                              >
                                Creator
                              </button>
                            )}
                            {bulkDeleteToolbar.onBulkUpdateEvaluator && (
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                onClick={() => {
                                  setUpdateAllMenuOpen(false);
                                  setBulkEvaluatorEmail("");
                                  setShowBulkEvaluatorModal(true);
                                }}
                              >
                                Evaluator
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
                          Delete selected ({bulkDeleteToolbar.selectedCount})
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
