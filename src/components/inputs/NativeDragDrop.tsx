"use client";
import {
  useRef,
  useState,
  DragEvent,
  ChangeEvent,
  Dispatch,
  SetStateAction,
} from "react";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  BatchTasksTypes,
  EvalTaskTypes,
  guidelineTypes,
  EvalOutputTypes,
} from "@/types/data";
import { isValidBatchData } from "@/helpers/validate_uploading_batch";
import { DomainTypes, EvalTypeTypes } from "@/types/others";
import { useUser } from "@/context/UserContext";
import Modal from "@/components/utils/Modal";
import Button from "@/components/utils/Button";

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const batch_detail_temp = {
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
  created_at: `${formatDate(new Date())}`,
  number_of_tasks: 0,
  annotated_tasks: 0,
  qa_id: null,
  rating_guideline: [] as guidelineTypes[],
  domains: [] as DomainTypes[],
};

type NativeDragDropProps = {
  setBatchDetails: Dispatch<SetStateAction<BatchDetailTypes[]>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  datasetType: EvalTypeTypes;
};

export default function NativeDragDrop({
  setBatchDetails,
  loading,
  setLoading,
  datasetType,
}: NativeDragDropProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { user } = useUser();
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: "info" | "success" | "error";
  } | null>(null);

  const readFileContent = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
  };

  const validateFile = (file: File): boolean => {
    const isValid =
      file.type === "application/json" || file.name.endsWith(".json");

    if (!isValid) {
      setError("Only JSON file is allowed.");
      setFile(null);
      setFileContent(null);
      return false;
    }

    setError(null);
    setFile(file);
    readFileContent(file); // 🔹 Read on valid selection
    return true;
  };

  const generateUniqueId = (): string => {
    return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateFile(droppedFile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateFile(selectedFile);
  };

  const generateFileDetail = (data: ASRBatchTasksTypes | BatchTasksTypes) => {
    const batch_id = generateUniqueId();

    const batche_details = { ...batch_detail_temp };
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

    batche_details.dataset_type = datasetType.value; // mt, asr, tts
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

    console.log("evaluatedTasks:", evaluatedTasks);

    return batche_details;
  };

  const resetUploading = () => {
    setFile(null);
    setFileContent(null);

    // ✅ Reset the file input value so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // ← this line is key
    }
  };

  const handleSave = async () => {
    if (fileContent) {
      const data = JSON.parse(fileContent);

      // CHECK IF THE DATASET IS VALID OR NOT
      const res = isValidBatchData(datasetType.value, data);
      if (!res.isValid) {
        console.log(res.message);
        setNotice({ title: "Invalid file", message: `${res.message}`, variant: "error" });
        return false;
      }

      const details = generateFileDetail(data);
      if (!details) return null;

      setLoading(true);
      const batch_detail = details;
      const tasks_batch = { ...data, batch_id: details.batch_id };

      try {
        const res = await fetch(`/api/batches/${datasetType.value}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batchDetail: batch_detail,
            batchTask: tasks_batch,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to save batch to server.");
        }

        setBatchDetails((prev) => [batch_detail, ...prev]);
      } catch (error) {
        console.error("API error:", error);
        setNotice({
          title: "Save failed",
          message: "Error saving data to server. Data is saved locally.",
          variant: "error",
        });
      }

      // Reset UI state
      resetUploading();
      setLoading(false);
      setNotice({ title: "Saved", message: "File content saved successfully.", variant: "success" });
    } else {
      setNotice({ title: "No data", message: "Data doesnt exist", variant: "error" });
      return [null, null];
    }
  };

  return (
    <div className="w-full space-y-3">
      <div
        onClick={() => (!loading ? fileInputRef.current?.click() : {})}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-1 border-dashed border-neutral-300 dark:border-neutral-800 rounded-lg p-6 text-center transition ${
          isDragging
            ? "bg-blue-100 border-blue-500"
            : "bg-white dark:bg-neutral-900"
        }
            ${loading ? "cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />
        <p className="text-neutral-700 dark:text-neutral-300">
          {isDragging
            ? "Drop the file here..."
            : "Click or drag a JSON file to upload an evaluation dataset."}
        </p>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {(file || fileContent) && (
          <div className="mt-4 text-sm space-y-5">
            {file && (
              <p className="text-green-600">
                <strong>Selected File:</strong> {file.name}
              </p>
            )}
            {/* <pre className="bg-neutral-100 dark:bg-neutral-900 p-2 rounded text-xs max-h-48 overflow-auto">
              {fileContent || "No content available"}
            </pre> */}
          </div>
        )}
      </div>

      {file && (
        <div className="w-full flex justify-end space-x-5">
          <button
            type="button"
            onClick={handleSave}
            className="text-blue-500 p-2 cursor-pointer rounded-md border border-transparent hover:border-current"
          >
            Save
          </button>
          <button
            type="button"
            onClick={resetUploading}
            className="text-red-500 p-2 cursor-pointer rounded-md border border-transparent hover:border-current"
          >
            Cancel
          </button>
        </div>
      )}

      <Modal
        isOpen={!!notice}
        setIsOpen={(open) => {
          if (open) return;
          setNotice(null);
        }}
        className="!max-w-md"
      >
        <div className="p-2">
          <h3 className="text-lg font-semibold mb-2">{notice?.title ?? "Notice"}</h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {notice?.message ?? ""}
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setNotice(null)}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
