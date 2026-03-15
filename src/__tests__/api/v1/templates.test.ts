import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/templates/[datasetType]/route";
import { makeRequest, mockCaller, CALLERS, json } from "@/test/helpers";

describe("Templates", () => {
  beforeEach(() => {
    mockCaller(CALLERS.user);
  });

  it("returns MT template with schema and example", async () => {
    const req = makeRequest("/api/v1/templates/mt");
    const res = await GET(req, { params: Promise.resolve({ datasetType: "mt" }) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.dataset_type).toBe("mt");
    expect(body.data.schema.required_fields).toHaveProperty("source_language");
    expect(body.data.schema.required_fields).toHaveProperty("target_language");
    expect(body.data.schema.example.tasks).toHaveLength(1);
  });

  it("returns ASR template", async () => {
    const req = makeRequest("/api/v1/templates/asr");
    const res = await GET(req, { params: Promise.resolve({ datasetType: "asr" }) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.dataset_type).toBe("asr");
    expect(body.data.schema.required_fields).toHaveProperty("language");
    expect(body.data.schema.required_fields).not.toHaveProperty("source_language");
  });

  it("returns TTS template", async () => {
    const req = makeRequest("/api/v1/templates/tts");
    const res = await GET(req, { params: Promise.resolve({ datasetType: "tts" }) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.dataset_type).toBe("tts");
  });

  it("handles case-insensitive dataset type", async () => {
    const req = makeRequest("/api/v1/templates/MT");
    const res = await GET(req, { params: Promise.resolve({ datasetType: "MT" }) });
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid dataset type", async () => {
    const req = makeRequest("/api/v1/templates/invalid");
    const res = await GET(req, { params: Promise.resolve({ datasetType: "invalid" }) });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns 401 when unauthenticated", async () => {
    const { mockUnauthenticated } = await import("@/test/helpers");
    mockUnauthenticated();
    const req = makeRequest("/api/v1/templates/mt");
    const res = await GET(req, { params: Promise.resolve({ datasetType: "mt" }) });
    expect(res.status).toBe(401);
  });
});
