export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";

const VALID_TYPES = ["mt", "asr", "tts"] as const;
type DatasetType = (typeof VALID_TYPES)[number];

type RouteParams = { params: Promise<{ datasetType: string }> };

const schemas: Record<DatasetType, object> = {
  mt: {
    required_fields: {
      batch_name: "string",
      dataset_domain: "string",
      source_language: "{ iso_639_3: string, iso_name: string }",
      target_language: "{ iso_639_3: string, iso_name: string }",
      tasks: "array",
    },
    task_fields: {
      id: "string | number",
      input: "string (plain text, not URL)",
      models: [
        {
          output: "string (plain text, not URL)",
          model: "string",
          rate: "number (0 = unrated)",
          rank: "number (0 = unranked)",
        },
      ],
      reference: "string (optional)",
      domain: "string[] (optional)",
    },
    example: {
      batch_name: "mt-en-am-news-01",
      dataset_domain: "news",
      source_language: { iso_639_3: "eng", iso_name: "English" },
      target_language: { iso_639_3: "amh", iso_name: "Amharic" },
      tasks: [
        {
          id: "1",
          input: "The conference will be held next week.",
          models: [
            { output: "ጉባኤው በሚቀጥለው ሳምንት ይካሄዳል።", model: "model_a", rate: 0, rank: 0 },
            { output: "ስብሰባው በቀጣይ ሳምንት ይደረጋል።", model: "model_b", rate: 0, rank: 0 },
          ],
        },
      ],
    },
  },
  asr: {
    required_fields: {
      batch_name: "string",
      dataset_domain: "string",
      language: "{ iso_639_3: string, iso_name: string }",
      tasks: "array",
    },
    task_fields: {
      id: "string | number",
      input: "string (URL or file path to audio)",
      models: [
        {
          output: "string (plain text transcription)",
          model: "string",
          rate: "number (0 = unrated)",
          rank: "number (0 = unranked)",
        },
      ],
      reference: "string (optional)",
      domain: "string[] (optional)",
    },
    example: {
      batch_name: "asr-am-broadcast-01",
      dataset_domain: "broadcast",
      language: { iso_639_3: "amh", iso_name: "Amharic" },
      tasks: [
        {
          id: "1",
          input: "https://example.com/audio/clip1.wav",
          models: [
            { output: "ዛሬ ጥሩ ቀን ነው", model: "whisper", rate: 0, rank: 0 },
            { output: "ዛሬ ጥሩ ቀን ነበር", model: "wav2vec", rate: 0, rank: 0 },
          ],
        },
      ],
    },
  },
  tts: {
    required_fields: {
      batch_name: "string",
      dataset_domain: "string",
      language: "{ iso_639_3: string, iso_name: string }",
      tasks: "array",
    },
    task_fields: {
      id: "string | number",
      input: "string (plain text to synthesize)",
      models: [
        {
          output: "string (URL or file path to audio)",
          model: "string",
          rate: "number (0 = unrated)",
          rank: "number (0 = unranked)",
        },
      ],
      reference: "string (optional)",
      domain: "string[] (optional)",
    },
    example: {
      batch_name: "tts-am-general-01",
      dataset_domain: "general",
      language: { iso_639_3: "amh", iso_name: "Amharic" },
      tasks: [
        {
          id: "1",
          input: "ዛሬ ጥሩ ቀን ነው።",
          models: [
            { output: "https://example.com/audio/tts_a.wav", model: "tacotron", rate: 0, rank: 0 },
            { output: "https://example.com/audio/tts_b.wav", model: "vits", rate: 0, rank: 0 },
          ],
        },
      ],
    },
  },
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const { datasetType } = await params;
  const dt = datasetType.toLowerCase() as DatasetType;

  if (!VALID_TYPES.includes(dt)) {
    return apiError(
      ErrorCodes.VALIDATION_FAILED,
      `Invalid dataset type '${datasetType}'. Must be one of: mt, asr, tts.`,
      400
    );
  }

  return apiSuccess({
    dataset_type: dt,
    schema: schemas[dt],
  });
}
