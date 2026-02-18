import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyTextProps {
  textToCopy: string;
}

const CopyText: React.FC<CopyTextProps> = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  // const handleCopy = async () => {
  //   try {
  //     await navigator.clipboard.writeText(textToCopy);
  //     setCopied(true);
  //     setTimeout(() => setCopied(false), 2000);
  //   } catch {
  //     setCopied(false);
  //   }
  // };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed"; // Prevent scroll jump
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      setCopied(false);
    }
  };

  return (
    <button
      className={`p-1 bg-transparent rounded opacity-70 font-light text-xs md:text-sm ${
        copied
          ? ""
          : "cursor-pointer hover:bg-gray-300 hover:dark:bg-gray-900/80"
      }`}
      onClick={handleCopy}
      title={`Copy "${`${textToCopy.slice(0, 25)} ${
        textToCopy.length > 25 ? "..." : ""
      }`.toLowerCase()}" to clipboard.`}
    >
      {copied ? (
        <div className="flex items-center space-x-0.5 text-green-500">
          <Check className="size-4" />
          <span className="hidden sm:block">Copied!</span>
        </div>
      ) : (
        <div className="flex space-x-0.5 items-center">
          <Copy className="size-4" />
          <span className="hidden sm:block">Copy</span>
        </div>
      )}
    </button>
  );
};

export default CopyText;
