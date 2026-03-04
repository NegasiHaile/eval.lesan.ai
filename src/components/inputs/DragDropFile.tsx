"use client";
import { useRef, useState, DragEvent, ChangeEvent } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ASRBatchTasksTypes, BatchTasksTypes } from "@/types/data";
import { EvalTypeTypes } from "@/types/others";
import { isValidBatchData } from "@/helpers/validate_uploading_batch";

export type BatchData = ASRBatchTasksTypes | BatchTasksTypes;

type NativeDragDropProps = {
  activeTab: EvalTypeTypes;
  loading: boolean;
  /** Called with a single batch when one file is selected, or an array when multiple files are selected. */
  onChange: (data: BatchData | BatchData[]) => void;
  required?: boolean;
};

type InvalidFile = { name: string; message: string };

type StatusType = {
  isValid: boolean | null;
  message: string;
  /** When multiple files: list of files that failed validation and need to be updated. */
  invalidFiles?: InvalidFile[];
  validCount?: number;
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
  const parseFileToJson = async (file: File): Promise<Record<string, unknown>> => {
    const ext = getFileExtension(file.name);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const content = reader.result;

        try {
          if (ext === "json") {
            const parsed = JSON.parse(content as string);
            // Do not modify tasks or task ids – use file as-is
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
            const tasks = (result.data as Record<string, unknown>[]).map((row, i) => {
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
            const tasks = (dataRows as unknown[][]).map((row: unknown[], i: number) => {
              const rowArray = row;
              const inputIndex = headersLower.indexOf("input");
              const task: Record<string, unknown> = {
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

  /** Process one file: parse and validate. When requireMetadata is true (multi-file), batch_name, dataset_domain, and language are required. */
  const processOneFile = (
    file: File,
    requireMetadata = false
  ): Promise<BatchData> => {
    const ext = getFileExtension(file.name);
    const typeIsSupported =
      SUPPORTED_TYPES.includes(file.type) ||
      ["json", "csv", "tsv", "xlsx", "xls"].includes(ext ?? "");

    if (!typeIsSupported) {
      return Promise.reject(
        "Unsupported file format. Please upload JSON, CSV, TSV, or Excel files."
      );
    }

    return parseFileToJson(file).then((data) => {
      const result = isValidBatchData(activeTab.value, data as BatchTasksTypes, {
        requireMetadata,
      });
      if (result.isValid) {
        return data as BatchData;
      }
      return Promise.reject(result.message);
    });
  };

  /** Process multiple files iteratively and call onChange once with single or array. */
  const processFiles = (files: FileList | null) => {
    if (!files?.length) return;

    const fileArray = Array.from(files);
    if (fileArray.length === 1) {
      processOneFile(fileArray[0], false)
        .then((data) => {
          onChange(data);
          setStatus({
            isValid: true,
            message: `File "${fileArray[0].name}" uploaded successfully.`,
          });
          if (fileInputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(fileArray[0]);
            fileInputRef.current.files = dt.files;
          }
        })
        .catch((err) => {
          setStatus({
            isValid: false,
            message: typeof err === "string" ? err : "Error parsing file.",
          });
        });
      return;
    }

    // Multiple files: validate one by one, collect only valid data and invalid file details
    const validData: BatchData[] = [];
    const invalidFiles: InvalidFile[] = [];

    const runNext = (index: number): void => {
      if (index >= fileArray.length) {
        if (validData.length === 0) {
          setStatus({
            isValid: false,
            message: invalidFiles[0] ? `${invalidFiles[0].name}: ${invalidFiles[0].message}` : "No valid files.",
            invalidFiles: invalidFiles.length > 0 ? invalidFiles : undefined,
          });
          return;
        }
        // Only pass valid files so parent uploads only those
        onChange(validData.length === 1 ? validData[0] : validData);
        setStatus({
          isValid: true,
          message:
            invalidFiles.length > 0
              ? `${validData.length} file(s) are valid and will be uploaded. ${invalidFiles.length} file(s) need to be updated.`
              : `${validData.length} file(s) are valid and ready to upload.`,
          validCount: validData.length,
          invalidFiles: invalidFiles.length > 0 ? invalidFiles : undefined,
        });
        if (fileInputRef.current) {
          const dt = new DataTransfer();
          fileArray.forEach((f) => dt.items.add(f));
          fileInputRef.current.files = dt.files;
        }
        return;
      }

      processOneFile(fileArray[index], true)
        .then((data) => {
          validData.push(data);
          runNext(index + 1);
        })
        .catch((err) => {
          invalidFiles.push({
            name: fileArray[index].name,
            message: typeof err === "string" ? err : "Error parsing or validating file.",
          });
          runNext(index + 1);
        });
    };

    runNext(0);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files?.length) processFiles(files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) processFiles(files);
  };

  const openFileDialog = () => {
    if (!loading) fileInputRef.current?.click();
  };

  const borderStyle = isDragging
    ? "bg-neutral-300/50 dark:bg-neutral-800/50 border-blue-500"
    : "bg-white dark:bg-neutral-900";

  const message =
    status.isValid === false ? (
      <div className="mt-2 text-sm space-y-1">
        <p className="text-red-600">{status.message}</p>
        {status.invalidFiles && status.invalidFiles.length > 0 && (
          <p className="font-medium text-red-700 dark:text-red-400 mt-2">
            The following file(s) need to be updated:
          </p>
        )}
        {status.invalidFiles?.map((f, i) => (
          <p key={i} className="text-red-600 pl-2 text-xs">
            <span className="font-mono font-medium">{f.name}</span>: {f.message}
          </p>
        ))}
      </div>
    ) : status.isValid === true ? (
      <div className="mt-2 text-sm space-y-1">
        <p className="text-green-600">{status.message}</p>
        {status.invalidFiles && status.invalidFiles.length > 0 && (
          <>
            <p className="font-medium text-amber-600 dark:text-amber-400 mt-2">
              The following file(s) need to be updated (not uploaded):
            </p>
            <ul className="list-disc list-inside text-amber-600 dark:text-amber-400 text-xs space-y-0.5 pl-2">
              {status.invalidFiles.map((f, i) => (
                <li key={i}>
                  <span className="font-mono">{f.name}</span>: {f.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
        className={`relative border-1 border-dashed border-neutral-300 dark:border-neutral-800 rounded-lg p-6 text-center transition ${borderStyle} ${
          loading ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          name="uploadFile"
          accept=".json,.csv,.tsv,.xls,.xlsx"
          className="hidden"
          multiple
          onChange={handleFileChange}
          disabled={loading}
          required={required}
        />

        <p className="text-neutral-700 dark:text-neutral-300">
          {isDragging
            ? "Drop file(s) here..."
            : "Click or drag one or more JSON, CSV, TSV, or Excel files to upload."}
        </p>

        {message}
      </div>
    </div>
  );
}
