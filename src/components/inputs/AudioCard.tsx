"use client";
import { EvalOutputTypes } from "@/types/data";
import React, { useRef, useState } from "react";
import Button from "../utils/Button";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Mic,
  Square,
} from "lucide-react";

interface AudioCardProps {
  index?: number;
  type: string;
  task?: EvalOutputTypes;
  input_url?: string;
  loading?: boolean;
  className?: string;
  nodownload?: boolean;
}

const AudioCard: React.FC<AudioCardProps> = ({
  index,
  type,
  task,
  input_url = null,
  loading = false,
  className,
  nodownload,
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const url = type === "input" ? input_url : task?.output;

  // console.log("input:", input_url);

  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | undefined>(undefined);

  const startRecording = async () => {
    setAudioURL(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error("Microphone access error:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const transcribe = async () => {
    if (!audioURL) return;
    setAudioURL(undefined);
    alert(
      "Realtime transcription is coming soon, for now this is only for dataset evaluation!"
    ); // Placeholder for actual transcription logic
  };

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div
        key={index}
        className={`w-full bg-neutral-200/70 dark:bg-neutral-800/30 border border-neutral-200/80 dark:border-neutral-800/70 shadow-md rounded-lg ${
          type === "input" ? "py-8" : ""
        }`}
      >
        <div className="w-full p-2 flex space-x-2 items-center">
          {url ? (
            <audio
              key={url}
              controls
              controlsList={nodownload ? "nodownload" : ""}
              src={`/api/audio-stream?url=${encodeURIComponent(url as string)}`}
              className="w-full px-1 py-1 h-16 rounded-full"
              title="Reader"
            >
              {/* <source src={audioURL ?? undefined} /> */}
              Your browser does not support the audio element.
            </audio>
          ) : (
            <audio
              key={audioURL}
              controls
              // controlsList={nodownload ? "nodownload" : ""}
              src={audioURL ?? undefined}
              className="w-full px-1 py-1 h-16 rounded-full"
              title="Recorder"
            >
              {/* <source src={audioURL ?? undefined} /> */}
              Your browser does not support the audio element.
            </audio>
          )}

          {type === "input" && !input_url && (
            <>
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="relative p-3 rounded-full text-red-500 hover:text-red-700 bg-neutral-100/80 hover:bg-red-400/20 dark:bg-neutral-900 transition duration-500 shadow-md cursor-pointer"
                  title="Start Recording"
                >
                  {/* Pulse ring effect */}

                  {/* Microphone Icon */}
                  <Mic className="size-6" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="relative bg-red-500 isolate p-3 rounded-full hover:bg-red-400 shadow-md  transition hover:scale-100 duration-200 group cursor-pointer"
                  title="Stop Recording"
                >
                  <span
                    className="absolute inset-0 rounded-full animate-ping bg-red-500/80 group-hover:bg-red-500/20"
                    aria-hidden="true"
                  ></span>
                  {/* Stop Icon (circle with square) */}
                  <Square className="size-6 text-white" />
                </button>
              )}
            </>
          )}
        </div>

        {type === "output" && task && (
          <div className="flex space-x-3 pr-4 items-center justify-between">
            <div className="w-fit flex space-x-1 items-center p-2 bg-neutral-100 dark:bg-neutral-900/80 rounded-bl-md rounded-tr-xl">
              🎙️
              <p className="font-mono text-sm">
                Model
                <span className="text-lg font-extrabold"> {task.model}</span>
              </p>
            </div>

            <div className="flex space-x-3 items-center">
              <button
                id="up_arrow"
                //   onClick={onClickRankUp}
                className="cursor-pointer opacity-80 hover:opacity-50 group"
              >
                {/* Up Arrow SVG */}
                <ArrowUpFromLine
                  strokeWidth={1.5}
                  className="size-5 md:size-7 transition-transform duration-200 group-hover:-translate-y-1"
                />
              </button>

              <button
                id="down_arrow"
                className="cursor-pointer opacity-80 hover:opacity-50 group"
              >
                {/* Down Arrow SVG */}
                <ArrowDownToLine
                  strokeWidth={1.5}
                  className="size-5 md:size-7 transition-transform duration-200 group-hover:translate-y-1"
                />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`cursor-pointer hover:opacity-60`}
                  disabled={false}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1}
                    stroke="currentColor"
                    className={`size-4 md:size-6`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {type === "input" && audioURL && !!!input_url && (
        <div className="w-full flex justify-end items-center">
          <div className="mt-2 w-fit items-end">
            <Button
              type="button"
              text={loading ? "Transcribing" : "Transcribe"}
              variant="secondary"
              outline={true}
              onClick={transcribe}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioCard;
