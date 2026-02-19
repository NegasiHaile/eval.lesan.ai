import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { TEMPLATES } from "@/constants/templates";

const FILE_EXTENSIONS = {
  JSON: "json",
  CSV: "csv",
  TSV: "tsv",
  Excel: "xlsx",
};

function generateContent(
  taskKey: keyof typeof TEMPLATES,
  format: keyof typeof FILE_EXTENSIONS
): string {
  const data = TEMPLATES[taskKey];

  if (format === "JSON") {
    return JSON.stringify(data, null, 2);
  }

  let headers: string[] = [];
  let rows: string[][] = [];

  const delimiter = format === "CSV" ? "," : format === "TSV" ? "\t" : "|";

  const escapeCell = (cell: string) => {
    if (cell.includes(delimiter) || cell.includes('"') || cell.includes("\n")) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const allModels = Array.from(
    new Set(data.tasks.flatMap((t) => t.models.map((m) => m.model)))
  ).sort();
  headers = ["id", "input", ...allModels.map((m) => `${m}`)];

  rows = data.tasks.map((t) => {
    const base = [t.id, t.input];
    const outputs = allModels.map(
      (modelName) => t.models.find((m) => m.model === modelName)?.output || ""
    );
    return [...base, ...outputs];
  });

  const lines = [headers.map(escapeCell).join(delimiter)];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(delimiter));
  }

  return lines.join("\n");
}

function parseTableData(
  content: string,
  format: keyof typeof FILE_EXTENSIONS
): { headers: string[]; rows: string[][] } {
  let delimiter = ",";
  if (format === "TSV") delimiter = "\t";
  else if (format === "Excel") delimiter = "|";

  const lines = content.trim().split("\n");

  const parseLine = (line: string) => {
    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i + 1 < line.length ? line[i + 1] : null;

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    // For Excel filter empty trailing columns
    return format === "Excel" ? result.filter((c) => c.length > 0) : result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

const DatasetUploadGuidelines = ({
  activeTab,
}: {
  activeTab: "MT" | "ASR";
}) => {
  const [activeFormat, setActiveFormat] =
    useState<keyof typeof FILE_EXTENSIONS>("JSON");
  const [activeTask, setActiveTask] =
    useState<keyof typeof TEMPLATES>(activeTab);

  const handleDownload = () => {
    const content = generateContent(activeTask, activeFormat);
    const fileExt = FILE_EXTENSIONS[activeFormat];
    const BOM = "\uFEFF"; // UTF-8 BOM

    // Handle Excel separately using SheetJS
    if (activeFormat === "Excel") {
      const rows = content
        .split("\n")
        .map((line) => line.split("|").map((cell) => cell.trim()));

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");

      XLSX.writeFile(wb, `template_${activeTask.toLowerCase()}_excel.xlsx`);
      return;
    }

    // Set MIME type and prepend BOM where needed
    let mimeType = "text/plain;charset=utf-8";
    let finalContent = content;

    if (fileExt === "json") {
      mimeType = "application/json;charset=utf-8";
    } else if (fileExt === "csv") {
      mimeType = "text/csv;charset=utf-8";
      finalContent = BOM + content;
    } else if (fileExt === "tsv") {
      mimeType = "text/tab-separated-values;charset=utf-8";
      finalContent = BOM + content;
    } else if (fileExt === "txt") {
      mimeType = "text/plain;charset=utf-8";
      finalContent = BOM + content;
    }

    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${activeTask.toLowerCase()}_${activeFormat.toLowerCase()}.${fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTemplate = () => {
    if (activeFormat === "JSON") {
      return (
        <pre className="bg-neutral-100 dark:bg-neutral-800 text-xs rounded p-4 whitespace-pre-wrap">
          {generateContent(activeTask, "JSON")}
        </pre>
      );
    }

    const content = generateContent(activeTask, activeFormat);
    const { headers, rows } = parseTableData(content, activeFormat);

    return (
      <div className="overflow-auto max-h-64 py-3">
        <table className="w-full min-w-xl table-auto text-xs rounded">
          <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 font-semibold tracking-wider">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className={`border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-left`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-neutral-900 dark:text-neutral-200">
            {rows.map((row, ridx) => (
              <tr
                key={ridx}
                className={
                  ridx % 2 === 0
                    ? "bg-white dark:bg-neutral-900"
                    : "bg-neutral-50 dark:bg-neutral-800"
                }
              >
                {row.map((cell, cidx) => (
                  <td
                    key={cidx}
                    className={`border border-neutral-300 dark:border-neutral-700 p-2`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mx-auto py-10 font-mono text-sm max-w-4xl">
      {/* <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Supported File Types</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>
            <strong>JSON</strong>
          </li>
          <li>
            <strong>CSV</strong>
          </li>
          <li>
            <strong>TSV</strong>
          </li>
          <li>
            <strong>Excel</strong>
          </li>
        </ul>
      </section> */}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Choose Task Type</h2>
        <div className="flex gap-4 mb-4 flex-wrap">
          {Object.keys(TEMPLATES).map((taskKey) => (
            <button
              key={taskKey}
              onClick={() => setActiveTask(taskKey as keyof typeof TEMPLATES)}
              className={`px-3 py-1 rounded border cursor-pointer ${
                activeTask === taskKey
                  ? "border-blue-600 bg-blue-100 dark:bg-blue-900"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {taskKey}
            </button>
          ))}
        </div>
        <h2 className="font-semibold mb-2">Supported File Types</h2>
        <div className="flex gap-4 mb-4 flex-wrap">
          {Object.keys(FILE_EXTENSIONS).map((formatKey) => (
            <button
              key={formatKey}
              onClick={() =>
                setActiveFormat(formatKey as keyof typeof FILE_EXTENSIONS)
              }
              className={`px-3 py-1 rounded cursor-pointer ${
                activeFormat === formatKey
                  ? "bg-green-200 dark:bg-green-900"
                  : ""
              }`}
            >
              {formatKey}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Template Preview</h2>

        {renderTemplate()}
      </section>

      <p className="p-2 text-xs border-[0.5px] border-amber-500 bg-amber-300/20 rounded-md">
        Replace the model names (e.g., “google”, “lesan”) with the actual models
        you want to evaluate.
      </p>

      <section className="my-5">
        <button
          onClick={handleDownload}
          className="flex items-center bg-indigo-600 hover:bg-indigo-700 cursor-pointer text-white px-6 py-2 rounded font-semibold"
        >
          <Download className="size-5" /> Download {activeFormat}{" "}
          Template for {activeTask}
        </button>
      </section>

      <section className="mb-20">
        <h2 className="text-lg font-semibold mb-2">
          🧩 Task preparation code (Python)
        </h2>

        <pre className="bg-neutral-100 dark:bg-neutral-800 text-xs rounded p-4 overflow-auto whitespace-pre-wrap">
          {`
          Coming soon!
          
          `}
        </pre>
      </section>

      <footer className="text-sm text-neutral-500 text-center mt-8">
        Last updated: {new Date().toLocaleDateString()}
      </footer>
    </div>
  );
};

export default DatasetUploadGuidelines;
