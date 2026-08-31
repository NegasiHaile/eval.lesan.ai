/**
 * Shared test factories and mock builders for API v1 tests.
 */
import { NextRequest } from "next/server";
import { vi } from "vitest";
import type { ApiCaller } from "@/lib/api-types";

// ── Request builders ──────────────────────────────────────────────────

export function makeRequest(
  url: string,
  options?: RequestInit & { headers?: Record<string, string> }
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;
  return new NextRequest(fullUrl, options as ConstructorParameters<typeof NextRequest>[1]);
}

export function makeJsonRequest(
  url: string,
  method: string,
  body: unknown,
  headers?: Record<string, string>
): NextRequest {
  return makeRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ── Caller mocks ──────────────────────────────────────────────────────

export const CALLERS = {
  root: {
    username: "root@example.com",
    role: "root",
    source: "api_key" as const,
    scopes: ["*"],
  } satisfies ApiCaller,
  user: {
    username: "user@example.com",
    role: "user",
    source: "api_key" as const,
    scopes: ["*"],
  } satisfies ApiCaller,
  annotator: {
    username: "annotator@example.com",
    role: "user",
    source: "api_key" as const,
    scopes: ["*"],
  } satisfies ApiCaller,
  reviewer: {
    username: "reviewer@example.com",
    role: "user",
    source: "api_key" as const,
    scopes: ["*"],
  } satisfies ApiCaller,
  session: {
    username: "session@example.com",
    role: "user",
    source: "session" as const,
  } satisfies ApiCaller,
};

// We import the mocked modules at the top level — vitest resolves path aliases
// for static imports even though `require` can't.
import * as apiAuthMod from "@/lib/api-auth";
import * as authMod from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Override resolveApiCaller mock to return a specific caller.
 */
export function mockCaller(caller: ApiCaller) {
  vi.mocked(apiAuthMod.resolveApiCaller).mockResolvedValue(caller);
}

/**
 * Override requireAuth mock to return a specific session user.
 */
export function mockSession(user: { username: string; role: string }) {
  vi.mocked(authMod.requireAuth).mockResolvedValue(user);
}

/**
 * Override resolveApiCaller to return 401.
 */
export function mockUnauthenticated() {
  vi.mocked(apiAuthMod.resolveApiCaller).mockResolvedValue(
    NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    )
  );
}

// ── Response helpers ──────────────────────────────────────────────────

export async function json(res: Response) {
  return res.json();
}

// ── Seed data factories ───────────────────────────────────────────────

export function makeMtBatchDetail(overrides: Partial<{
  batch_id: string;
  batch_name: string;
  annotator_id: string | null;
  qa_id: string | null;
  created_by: string;
  created_at: string;
  number_of_tasks: number;
  annotated_tasks: number;
}> = {}) {
  return {
    batch_id: overrides.batch_id ?? "batch-001",
    batch_name: overrides.batch_name ?? "test-batch",
    dataset_type: "mt",
    dataset_domain: "news",
    source_language: { iso_639_3: "eng", iso_name: "English" },
    target_language: { iso_639_3: "amh", iso_name: "Amharic" },
    models: ["A", "B"],
    annotator_id: overrides.annotator_id ?? null,
    qa_id: overrides.qa_id ?? null,
    created_by: overrides.created_by ?? "root@example.com",
    created_at: overrides.created_at ?? new Date().toISOString(),
    number_of_tasks: overrides.number_of_tasks ?? 2,
    annotated_tasks: overrides.annotated_tasks ?? 0,
  };
}

export function makeMtBatchTasks(overrides: Partial<{
  batch_id: string;
  batch_name: string;
  tasks: unknown[];
  task_models_shuffles: Record<string, Record<string, string>>;
}> = {}) {
  return {
    batch_id: overrides.batch_id ?? "batch-001",
    batch_name: overrides.batch_name ?? "test-batch",
    dataset_domain: "news",
    source_language: { iso_639_3: "eng", iso_name: "English" },
    target_language: { iso_639_3: "amh", iso_name: "Amharic" },
    tasks: overrides.tasks ?? [
      {
        id: "1",
        input: "Hello world",
        models: [
          { output: "ሰላም ዓለም", model: "A", rate: 0, rank: 0 },
          { output: "ሰላም ለዓለም", model: "B", rate: 0, rank: 0 },
        ],
      },
      {
        id: "2",
        input: "Good morning",
        models: [
          { output: "እንደምን አደርክ", model: "A", rate: 0, rank: 0 },
          { output: "መልካም ጥዋት", model: "B", rate: 0, rank: 0 },
        ],
      },
    ],
    task_models_shuffles: overrides.task_models_shuffles ?? {
      "1": { A: "model_a", B: "model_b" },
      "2": { A: "model_a", B: "model_b" },
    },
  };
}

export function makeEvaluatedTasks() {
  return [
    {
      id: "1",
      input: "Hello world",
      models: [
        { output: "ሰላም ዓለም", model: "A", rate: 4, rank: 1 },
        { output: "ሰላም ለዓለም", model: "B", rate: 3, rank: 2 },
      ],
      active_duration_ms: 5000,
    },
    {
      id: "2",
      input: "Good morning",
      models: [
        { output: "እንደምን አደርክ", model: "A", rate: 5, rank: 1 },
        { output: "መልካም ጥዋት", model: "B", rate: 3, rank: 2 },
      ],
      active_duration_ms: 3000,
    },
  ];
}

export function makeTtsAnnotationBatchDetail(overrides: Partial<{
  batch_id: string;
  batch_name: string;
  annotator_id: string | null;
  qa_id: string | null;
  created_by: string;
  number_of_tasks: number;
  annotated_tasks: number;
}> = {}) {
  return {
    batch_id: overrides.batch_id ?? "tts-batch-001",
    batch_name: overrides.batch_name ?? "tts-annotation-batch",
    dataset_type: "tts",
    dataset_domain: "general",
    workflow: "annotation",
    source_language: { iso_639_3: "tir", iso_name: "Tigrinya" },
    target_language: { iso_639_3: "tir", iso_name: "Tigrinya" },
    models: [],
    annotator_id: overrides.annotator_id ?? null,
    qa_id: overrides.qa_id ?? null,
    created_by: overrides.created_by ?? "root@example.com",
    created_at: new Date().toISOString(),
    number_of_tasks: overrides.number_of_tasks ?? 2,
    annotated_tasks: overrides.annotated_tasks ?? 0,
  };
}

export function makeTtsAnnotationBatchTasks(overrides: Partial<{
  batch_id: string;
  batch_name: string;
  tasks: unknown[];
}> = {}) {
  return {
    batch_id: overrides.batch_id ?? "tts-batch-001",
    batch_name: overrides.batch_name ?? "tts-annotation-batch",
    dataset_domain: "general",
    workflow: "annotation",
    language: { iso_639_3: "tir", iso_name: "Tigrinya" },
    tasks: overrides.tasks ?? [
      { id: "1", input: "ሰላም ከመይ ኣለኻ።", models: [], reference: "" },
      { id: "2", input: "ጽቡቕ መዓልቲ።", models: [], reference: "" },
    ],
  };
}

export function makeTtsEvaluationBatchDetail(overrides: Partial<{
  batch_id: string;
  created_by: string;
  annotator_id: string | null;
}> = {}) {
  return {
    batch_id: overrides.batch_id ?? "tts-eval-001",
    batch_name: "tts-evaluation-batch",
    dataset_type: "tts",
    dataset_domain: "general",
    workflow: "evaluation",
    source_language: { iso_639_3: "tir", iso_name: "Tigrinya" },
    target_language: { iso_639_3: "tir", iso_name: "Tigrinya" },
    models: ["model_a", "model_b"],
    annotator_id: overrides.annotator_id ?? null,
    qa_id: null,
    created_by: overrides.created_by ?? "root@example.com",
    created_at: new Date().toISOString(),
    number_of_tasks: 1,
    annotated_tasks: 0,
  };
}

export function makeTtsEvaluationBatchTasks(overrides: Partial<{
  batch_id: string;
}> = {}) {
  return {
    batch_id: overrides.batch_id ?? "tts-eval-001",
    batch_name: "tts-evaluation-batch",
    dataset_domain: "general",
    workflow: "evaluation",
    language: { iso_639_3: "tir", iso_name: "Tigrinya" },
    tasks: [
      {
        id: "1",
        input: "ሰላም ከመይ ኣለኻ።",
        models: [
          { output: "https://example.com/a.wav", model: "A", rate: 0, rank: 0 },
          { output: "https://example.com/b.wav", model: "B", rate: 0, rank: 0 },
        ],
      },
    ],
    task_models_shuffles: { "1": { A: "model_a", B: "model_b" } },
  };
}

export function makeUser(overrides: Partial<{
  email: string;
  name: string;
  role: string;
  active: boolean;
}> = {}) {
  return {
    email: overrides.email ?? "user@example.com",
    name: overrides.name ?? "Test User",
    role: overrides.role ?? "user",
    active: overrides.active ?? true,
    createdAt: new Date(),
  };
}

// ── DB helper ─────────────────────────────────────────────────────────

export async function getDb() {
  const getClientPromise = (await import("@/lib/mongodb")).default;
  const client = await getClientPromise();
  return client.db();
}
