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

  const [recording, setRecording] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string | undefined>(undefined);

  const stopActiveStream = () => {
    activeStreamRef.current?.getTracks().forEach((track) => track.stop());
    activeStreamRef.current = null;
  };

  const clearDraft = useCallback(() => {
    if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    draftUrlRef.current = undefined;
    setDraftUrl(undefined);
    recordedBlobRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
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

      mediaRecorder.onstop = () => {
        const rawType = mediaRecorder.mimeType || recordingMimeType;
        const normalizedType = normalizeAudioContentType(rawType);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: normalizedType,
        });
        recordedBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        draftUrlRef.current = url;
        setDraftUrl(url);
        stopActiveStream();
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      stopActiveStream();
    }
  }, [clearDraft]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  useEffect(() => {
    return () => {
      stopActiveStream();
      if (draftUrlRef.current) URL.revokeObjectURL(draftUrlRef.current);
    };
  }, []);

  return {
    recording,
    draftUrl,
    hasDraft: Boolean(draftUrl),
    recordedBlobRef,
    startRecording,
    stopRecording,
    clearDraft,
  };
}
