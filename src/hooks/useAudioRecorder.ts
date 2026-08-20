"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeAudioContentType,
  pickRecordingMimeType,
} from "@/constants/transcription";

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const draftUrlRef = useRef<string | undefined>(undefined);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState(0);

  const stopActiveStream = () => {
    activeStreamRef.current?.getTracks().forEach((track) => track.stop());
    activeStreamRef.current = null;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const freezeElapsed = () => {
    if (!startedAtRef.current) return;
    setElapsedMs(Date.now() - startedAtRef.current);
  };

  const clearDraft = useCallback(() => {
    if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    draftUrlRef.current = undefined;
    setDraftUrl(undefined);
    recordedBlobRef.current = null;
    startedAtRef.current = null;
    setElapsedMs(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === "recording") return true;

    clearDraft();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;

      audioChunksRef.current = [];
      const recordingMimeType = pickRecordingMimeType();
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: recordingMimeType,
        });
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onerror = () => {
        freezeElapsed();
        stopTimer();
        setRecording(false);
        stopActiveStream();
      };

      mediaRecorder.onstop = () => {
        freezeElapsed();
        stopTimer();
        const rawType = mediaRecorder.mimeType || recordingMimeType;
        const normalizedType = normalizeAudioContentType(rawType);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: normalizedType,
        });
        recordedBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        draftUrlRef.current = url;
        setDraftUrl(url);
        setRecording(false);
        stopActiveStream();
      };

      mediaRecorder.start(1000);
      setRecording(true);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      stopTimer();
      timerRef.current = setInterval(() => {
        if (!startedAtRef.current) return;
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
      return true;
    } catch (err) {
      console.error("Microphone access error:", err);
      stopActiveStream();
      stopTimer();
      setRecording(false);
      return false;
    }
  }, [clearDraft]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
    freezeElapsed();
    stopTimer();
  }, []);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }
      stopTimer();
      stopActiveStream();
      if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    };
  }, []);

  return {
    recording,
    draftUrl,
    hasDraft: Boolean(draftUrl),
    recordedBlobRef,
    elapsedMs,
    startRecording,
    stopRecording,
    clearDraft,
  };
}
