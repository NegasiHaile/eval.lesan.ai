"use client";
import { useRef, useState, DragEvent, ChangeEvent } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ASRBatchTasksTypes, BatchTasksTypes } from "@/types/data";
import { EvalTypeTypes } from "@/types/others";
import { isValidBatchData } from "@/helpers/validate_uploading_batch";

type NativeDragDropProps = {
  activeTab: EvalTypeTypes;
  loading: boolean;
  onChange: (data: ASRBatchTasksTypes | BatchTasksTypes) => void;
  required?: boolean;
};

type StatusType = {
  isValid: boolean | null;
  message: string;
};

export default function DragDropFile({
  activeTab,
  loading,
  onChange,
  required,
}: NativeDragDropProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<StatusType>({
    isValid: null,
    message: "",
  });

  const [isDragging, setIsDragging] = useState(false);

  const SUPPORTED_TYPES = [
    "application/json",
    "text/csv",
    "text/tab-separated-values",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  const getFileExtension = (name: string) =>
    name.split(".").pop()?.toLowerCase();

  // Convert file content to JSON
  const parseFileToJson = async (file: File): Promise<any> => {
    const ext = getFileExtension(file.name);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const content = reader.result;

        try {
          if (ext === "json") {
            const parsed = JSON.parse(content as string);

            // Ensure unique task IDs
            if (Array.isArray(parsed.tasks)) {
              parsed.tasks = parsed.tasks.map((task: any, index: number) => ({
                ...task,
                id: (index + 1).toString(),
              }));
            }
            resolve(parsed);
          } else if (ext === "csv" || ext === "tsv") {
            const delimiter = ext === "tsv" ? "\t" : ",";
            const result = Papa.parse(content as string, {
              header: true,
              delimiter,
              skipEmptyLines: true,
            });

            // Check for unnamed columns
            const unnamedColumns: number[] = [];
            result.meta.fields?.forEach((field, index) => {
              if (!field || field.trim() === "") unnamedColumns.push(index + 1); // 1-based
            });

            if (unnamedColumns.length > 0) {
              return reject(
                `The column${
                  unnamedColumns.length > 1 ? "s" : ""
                } ${unnamedColumns.join(
                  ", "
                )} doesn't have a name. Please make sure all columns have a name.`
              );
            }

            const fieldsLower = result.meta.fields!.map((f) => f.toLowerCase());
            const tasks = (result.data as any[]).map((row, i) => {
              const inputIndex = fieldsLower.indexOf("input");
              return {
                id: row.id || String(i + 1),
                input:
                  inputIndex >= 0
                    ? row[result.meta.fields![inputIndex]] || ""
                    : "",
                models: Object.entries(row)
                  .filter(
                    ([key]) =>
                      key.toLowerCase() !== "id" &&
                      key.toLowerCase() !== "input"
                  )
                  .map(([modelName, output]) => ({
                    output: output || "",
                    model: modelName,
                    rate: 0,
                    rank: 0,
                  })),
              };
            });

            resolve({ tasks });
          } else if (ext === "xlsx" || ext === "xls") {
            const workbook = XLSX.read(content, { type: "binary" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // array of arrays

            const rawHeaders = rows[0] as string[];
            const headersLower = rawHeaders.map((h) =>
              typeof h === "string" ? h.trim().toLowerCase() : ""
            );

            // Check for unnamed columns
            const unnamedColumns: number[] = [];
            rawHeaders.forEach((header, idx) => {
              if (!header || header.toString().trim() === "")
                unnamedColumns.push(idx + 1); // 1-based
            });

            if (unnamedColumns.length > 0) {
              return reject(
                `The column${
                  unnamedColumns.length > 1 ? "s" : ""
                } ${unnamedColumns.join(
                  ", "
                )} doesn't have a name. Please make sure all columns have a name.`
              );
            }

            const dataRows = rows.slice(1); // skip header
            const tasks = (dataRows as any[]).map((row: any, i: number) => {
              const rowArray = row as any[];
              const inputIndex = headersLower.indexOf("input");
              const task: any = {
                id: String(i + 1),
                input: inputIndex >= 0 ? rowArray[inputIndex] || "" : "",
              };
              task.models = rawHeaders
                .map((header, colIdx) => ({ header, value: rowArray[colIdx] }))
                .filter(
                  (item) =>
                    item.header.toLowerCase() !== "id" &&
                    item.header.toLowerCase() !== "input"
                )
                .map((item) => ({
                  output: item.value || "",
                  model: item.header,
                  rate: 0,
                  rank: 0,
                }));
              return task;
            });

            resolve({ tasks });
          } else {
            reject("Unsupported file format.");
          }
        } catch (err) {
          reject(`Failed to parse file. ${err}`);
        }
      };

      reader.onerror = () => reject("Error reading file.");

      if (ext === "xlsx" || ext === "xls") {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const validateAndProcessFile = (file: File) => {
    const ext = getFileExtension(file.name);
    const typeIsSupported =
      SUPPORTED_TYPES.includes(file.type) ||
      ["json", "csv", "tsv", "xlsx", "xls"].includes(ext ?? "");

    if (!typeIsSupported) {
      setStatus({
        isValid: false,
        message:
          "Unsupported file format. Please upload JSON, CSV, TSV, or Excel files.",
      });
      return;
    }

    parseFileToJson(file)
      .then((data) => {
        const result = isValidBatchData(activeTab.value, data);
        if (result.isValid) {
          onChange(data);
          setStatus({
            isValid: true,
            message: `File "${file.name}" uploaded successfully.`,
          });
        } else {
          setStatus(result);
        }
      })
      .catch((err) => {
        setStatus({
          isValid: false,
          message: typeof err === "string" ? err : "Error parsing file.",
        });
      });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndProcessFile(file);

      // ✅ Make the hidden input hold the dropped file
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInputRef.current.files = dt.files;
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndProcessFile(file);
  };

  const openFileDialog = () => {
    if (!loading) fileInputRef.current?.click();
  };

  const borderStyle = isDragging
    ? "bg-gray-300/50 dark:bg-gray-800/50 border-blue-500"
    : "bg-white dark:bg-gray-900";

  const message =
    status.isValid === false ? (
      <p className="mt-2 text-sm text-red-600">{status.message}</p>
    ) : status.isValid === true ? (
      <p className="text-green-600">{status.message}</p>
    ) : null;

  return (
    <div className="w-full space-y-3">
      <div
        onClick={openFileDialog}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-1 border-dashed border-gray-300 dark:border-gray-800 rounded-lg p-6 text-center transition ${borderStyle} ${
          loading ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          name="uploadFile" // ✅ required for validation
          accept=".json,.csv,.tsv,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
          required={required}
        />

        <p className="text-gray-700 dark:text-gray-300">
          {isDragging
            ? "Drop the file here..."
            : "Click or drag a JSON, CSV, TSV, or Excel file to upload."}
        </p>

        {message}
      </div>
    </div>
  );
}
