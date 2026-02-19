"use client";
import DatasetsTable from "@/components/tables/DatasetsTable";
import React, { useState, useEffect } from "react";
import { BatchDetailTypes } from "@/types/data";
import { useUser } from "@/context/UserContext";
import Container from "@/components/utils/Container";
import TabButton from "@/components/utils/TabButton";

import { evalTypes } from "@/constants/others";
import { EvalTypeTypes } from "@/types/others";

import { Info, Languages, Mic, Plus, RefreshCw } from "lucide-react";
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
  const { user } = useUser();

  const [showUploader, setShowUploader] = useState<boolean>(false);

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
            <div className="w-full flex gap-2 justify-between items-start">
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
                  loading={loading}
                  title={`Refresh ${activeTab.name} datasets`}
                >
                  <RefreshCw className="size-5 shrink-0" />
                  <span className="hidden sm:block">Refresh</span>
                </Button>
                {user?.role !== "user" && (
                  <Button
                    className="!w-fit !text-nowrap text-center font-mono"
                    outline={true}
                    minimal
                    size="sm"
                    onClick={() => setShowUploader(true)}
                    title={`Upload batch based ${activeTab.name} data for evaluation`}
                  >
                    <Plus className="size-5 shrink-0" />
                    <span className="hidden sm:block">
                      Upload {activeTab.name} tasks
                    </span>
                  </Button>
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
            />
          </div>
        </div>
      </Container>
  );
};

export default Datasets;
