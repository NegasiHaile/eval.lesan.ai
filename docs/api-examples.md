# HornEval API v1 — Usage Examples

Base URL: `https://your-domain.com/api/v1`

All endpoints require authentication, via either:

- **API key** — `Authorization: Bearer heval_...`
- **Session cookie** — for first-party / browser use

## Scopes

API keys carry **scopes**, and a key may only call endpoints its scopes permit. A request made with an insufficient scope returns `403`.

| Scope | Grants |
|---|---|
| `batches:read` | List/get batches, list/get tasks' parent batches, results, export |
| `batches:write` | Create/update/delete batches, assign/unassign annotators & reviewers |
| `tasks:read` | List/get tasks |
| `tasks:write` | Submit evaluations and reviewer comments |
| `users:read` | List users |
| `users:write` | Update a user's role / active state |
| `presence:read` | Query presence |
| `templates:read` | Fetch batch templates |
| `webhooks:read` | List webhooks |
| `webhooks:write` | Register / delete webhooks |
| `*` | All of the above |

Notes:

- A key resolves its owner's **current** role on every request. If the owner is demoted or deactivated, the key immediately loses the corresponding access — even before it is revoked.
- `GET /users/me` requires no scope; any valid key may read its own identity.
- Session callers are not scope-limited (scopes apply to API keys only).
- API-key management (`/api-keys`) is **session-only** and cannot be performed with an API key.

## Error responses

Errors use a consistent envelope:

```json
{ "error": { "code": "FORBIDDEN", "message": "API key missing required scope: batches:write" } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Malformed body / query params |
| 400 | `RATE_RANK_INCONSISTENT` | Ranking contradicts the ratings |
| 401 | `UNAUTHORIZED` | Missing, invalid, expired, or revoked key/session |
| 403 | `FORBIDDEN` | Authenticated but not permitted (role or scope) |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate batch name, or role already assigned |
| 422 | `UNPROCESSABLE_ENTITY` | e.g. results requested for a batch with no evaluations |

---

## 1. Authentication — API Keys

API-key management uses **session auth only** (these endpoints cannot be called with an API key).

### Create an API key

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -b "session-cookie" \
  -d '{"name": "CI Pipeline", "scopes": ["batches:read", "batches:write"], "expires_in_days": 90}'
```

`scopes` defaults to `["*"]` if omitted. The full key is returned **once** on creation — store it securely; it is never returned again.

**201 Created**
```json
{
  "data": {
    "key": "heval_a1b2c3d4e5f6...",
    "key_prefix": "heval_a1b2...",
    "name": "CI Pipeline",
    "scopes": ["batches:read", "batches:write"],
    "created_at": "2024-03-15T10:00:00.000Z",
    "expires_at": "2024-06-13T10:00:00.000Z"
  }
}
```

### List your API keys

```bash
curl http://localhost:3000/api/v1/api-keys \
  -b "session-cookie"
```

**200 OK** — Returns array of key metadata (never includes the full key).

### Revoke an API key

```bash
curl -X DELETE http://localhost:3000/api/v1/api-keys/6651a2b3c4d5e6f7a8b9c0d1 \
  -b "session-cookie"
```

**204 No Content**

---

## 2. Templates — Batch Schema

Requires scope `templates:read`.

### Get MT batch template

```bash
curl http://localhost:3000/api/v1/templates/mt \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK**
```json
{
  "data": {
    "dataset_type": "mt",
    "schema": {
      "required_fields": { "batch_name": "string", "source_language": "...", "target_language": "...", "tasks": "array" },
      "task_fields": { "id": "string | number", "input": "string", "models": [...] },
      "example": { ... }
    }
  }
}
```

Replace `mt` with `asr` or `tts` for other dataset types.

**TTS batches additionally require `workflow`**, and its value changes the task
shape, so fetch `GET /api/v1/templates/tts` rather than assuming the MT shape:

- `workflow: "annotation"` — voice collection. Each task is `{id, input}` where
  `input` is a prompt to read aloud, and carries **no `models`**. The annotator's
  recording is stored as a hosted `file_id` on the task's `reference`.
- `workflow: "evaluation"` — model comparison. Each task carries `models` with
  synthesized audio to rate and rank, like MT and ASR.

The template's `example` field holds one worked example per workflow.

---

## 3. Batch Lifecycle

### Create a batch

Requires scope `batches:write`.

```bash
curl -X POST http://localhost:3000/api/v1/batches \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id" \
  -d '{
    "dataset_type": "mt",
    "batch_name": "mt-en-am-news-01",
    "dataset_domain": "news",
    "source_language": {"iso_639_3": "eng", "iso_name": "English"},
    "target_language": {"iso_639_3": "amh", "iso_name": "Amharic"},
    "tasks": [
      {
        "id": "1",
        "input": "The conference will be held next week.",
        "models": [
          {"output": "ጉባኤው በሚቀጥለው ሳምንት ይካሄዳል።", "model": "model_a", "rate": 0, "rank": 0},
          {"output": "ስብሰባው በቀጣይ ሳምንት ይደረጋል።", "model": "model_b", "rate": 0, "rank": 0}
        ]
      }
    ]
  }'
```

> On creation, model names are **shuffled and anonymized** per task (e.g. `model_a` → `A`). Evaluations must reference the anonymized labels (see below); the mapping back to real names is stored on the batch and can be retrieved with `?include_shuffles=true` / `?include_original_models=true`.

**201 Created**
```json
{
  "data": {
    "batch_id": "a1b2c3d4-...",
    "batch_name": "mt-en-am-news-01",
    "dataset_type": "mt",
    "status": "pending",
    "number_of_tasks": 1,
    "created_at": "2024-03-15T10:00:00.000Z"
  }
}
```

### Create a TTS voice-collection batch

Requires scope `batches:write`. Annotation batches skip model shuffling — there
are no models to anonymize.

```bash
curl -X POST http://localhost:3000/api/v1/batches \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_type": "tts",
    "batch_name": "tir-voices-2026-08",
    "dataset_domain": "general",
    "language": {"iso_639_3": "tir", "iso_name": "Tigrinya"},
    "workflow": "annotation",
    "tasks": [
      {"id": "p1", "input": "ሰላም ከመይ ኣለኻ።"},
      {"id": "p2", "input": "ጽቡቕ መዓልቲ።"}
    ]
  }'
```

### Append tasks to an existing batch

Requires scope `tasks:write`. **Only the batch creator or a root user** — an
assigned annotator cannot extend their own workload.

This is the streaming counterpart to batch creation: an offline pipeline can push
new work into a batch that annotators are already using, instead of building the
whole batch up front.

```bash
curl -X POST http://localhost:3000/api/v1/batches/{batchId}/tasks \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: tir-voices-2026-08-chunk-3" \
  -d '{
    "tasks": [
      {"id": "p3", "input": "ሓድሽ ምሳሌ ጽሑፍ።"}
    ]
  }'
```

**201 Created**
```json
{
  "data": {
    "batch_id": "a1b2c3d4-...",
    "dataset_type": "tts",
    "appended": 1,
    "number_of_tasks": 3,
    "task_ids": ["p3"]
  }
}
```

Tasks are validated with the same rules as batch creation, taking batch-level
metadata (dataset type, workflow, language) from the stored batch. For
evaluation batches the appended models are shuffled and anonymized on their own,
leaving existing tasks' mappings untouched.

**Appends are all-or-nothing.** If any task id already exists in the batch, or
repeats within the payload, nothing is written and the call returns `409`:

```json
{"error": {"code": "CONFLICT", "message": "Task id(s) already present in batch '...' or repeated in the payload: p3."}}
```

Send an `Idempotency-Key` so a retry after a lost response replays the original
result instead of appending the same tasks twice.

> An annotator with the batch already open loads its tasks once on selection, so
> appended tasks surface on their next load of the batch, not mid-session.

### List batches

Requires scope `batches:read`.

```bash
curl "http://localhost:3000/api/v1/batches?dataset_type=mt&limit=10&status=in_progress" \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK** — Returns paginated list with `data` and `pagination` fields.

Valid `status` values: `pending`, `assigned`, `in_progress`, `annotated`, `completed`. Filtering is applied server-side, so `pagination.total_count` and cursors reflect the filter. Non-root callers only see batches they created, annotate, or review.

### Get batch detail

Requires scope `batches:read`.

```bash
curl http://localhost:3000/api/v1/batches/{batchId} \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK** — Full batch with tasks and metadata. Add `?include_shuffles=true` to include model shuffle mappings.

### Update batch metadata

Requires scope `batches:write` (and creator or root).

```bash
curl -X PATCH http://localhost:3000/api/v1/batches/{batchId} \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"batch_name": "updated-name", "dataset_domain": "science"}'
```

**200 OK**
```json
{"data": {"batch_id": "...", "updated_fields": ["batch_name", "dataset_domain"]}}
```

### Assign annotator

Requires scope `batches:write` (and creator or root).

```bash
curl -X POST http://localhost:3000/api/v1/batches/{batchId}/assign \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"role": "annotator", "email": "annotator@example.com"}'
```

**200 OK** — Use `PUT` instead to reassign (replace current). Assigning a role that is already filled returns `409`; use `PUT` to replace.

### Assign reviewer (root only)

Requires scope `batches:write` **and** a root caller.

```bash
curl -X POST http://localhost:3000/api/v1/batches/{batchId}/assign \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"role": "reviewer", "email": "reviewer@example.com"}'
```

### Unassign

Requires scope `batches:write`. Unassigning a reviewer is root-only; unassigning an annotator requires creator or root.

```bash
curl -X DELETE http://localhost:3000/api/v1/batches/{batchId}/assign/annotator \
  -H "Authorization: Bearer heval_your_key"
```

**204 No Content**

### List tasks

Requires scope `tasks:read`.

```bash
curl "http://localhost:3000/api/v1/batches/{batchId}/tasks?limit=20&status=pending" \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK** — Paginated tasks. Status: `pending`, `completed`, `reviewed`.

For TTS **annotation** batches, `completed` means the task has a recording
(`reference` is set) rather than a rating.

### Get single task

Requires scope `tasks:read`.

```bash
curl http://localhost:3000/api/v1/batches/{batchId}/tasks/{taskId} \
  -H "Authorization: Bearer heval_your_key"
```

### Submit evaluation

Requires scope `tasks:write` (annotator, creator, or root).

```bash
curl -X PATCH http://localhost:3000/api/v1/batches/{batchId}/tasks/{taskId} \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "models": [
      {"model": "A", "rate": 4, "rank": 1},
      {"model": "B", "rate": 3, "rank": 2}
    ],
    "active_duration_ms": 5000
  }'
```

> The `model` values must be the **anonymized labels** (e.g. `"A"`, `"B"`) returned by `GET .../tasks/{taskId}` — not the original model names supplied at batch creation.

**200 OK**
```json
{"data": {"message": "Task updated.", "task_id": "1"}}
```

### Submit a TTS recording (annotation batches)

Requires scope `tasks:write`. In a `workflow: "annotation"` batch the recording
**is** the submission, so the body carries `reference` and no `models`:

```bash
curl -X PATCH http://localhost:3000/api/v1/batches/{batchId}/tasks/{taskId} \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "file_abc123",
    "active_duration_ms": 4200
  }'
```

`reference` holds the hosted audio's `file_id` (as returned by `POST /api/uploads`),
never a URL — signed URLs expire, so playback resolves the id through
`/api/media/{file_id}` on demand. Omitting `reference` returns `400`.

Batch progress (`annotated_tasks`, and therefore `status`) counts tasks with a
recording for annotation batches, and rated tasks everywhere else.

> `POST /api/uploads` currently accepts a session cookie only, not an API key, so
> audio is uploaded from the browser. Programmatic callers set `reference` to a
> `file_id` that already exists.

### Reviewer pass on a TTS voice-collection batch

Requires scope `tasks:write`. The assigned reviewer (`qa_id`) has two remedies,
and they are the same before and after a take exists: **correct the prompt text**,
or **exclude the segment**. Audio is never edited — when a recording and its text
disagree, the text is corrected to match what was said, so an edit deliberately
**keeps** the existing recording.

```bash
# Fix the transcript to match what the reader actually said (take is preserved)
curl -X PATCH http://localhost:3000/api/v1/batches/{batchId}/tasks/{taskId} \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"input": "corrected text", "reviewer_comment": "matched to audio"}'

# Drop a segment that should not be in the dataset
curl -X PATCH http://localhost:3000/api/v1/batches/{batchId}/tasks/{taskId} \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"excluded": true, "reviewer_comment": "scraped page furniture, not a passage"}'
```

Rules:

- At least one of `reviewer_comment`, `input`, or `excluded` must be present.
- `reviewer_comment` is **required** when changing `input` or setting `excluded: true` —
  the corpus should never carry edits nobody can account for.
- A reviewer cannot set `reference`, submit ratings, or otherwise write the task
  wholesale; only these three fields are applied.
- Excluding a segment marks it **resolved**: readers are not asked to record it,
  and it counts toward batch completion so an excluded prompt cannot leave a batch
  permanently short. Exports **report** exclusions rather than filtering them —
  see the `export_action` field below.
- Each save stamps `reviewed_at` and refreshes `reviewed_tasks` on the batch.

### Submit reviewer comment (assigned reviewer only)

Requires scope `tasks:write`. Only the batch's **assigned reviewer** (`qa_id`) — or a root user — may set a reviewer comment, using this comment-only body:

```bash
curl -X PATCH http://localhost:3000/api/v1/batches/{batchId}/tasks/{taskId} \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"reviewer_comment": "Translation A is more natural"}'
```

Annotators submit ratings via the evaluation call above; a `reviewer_comment` field sent by a non-reviewer is ignored. A non-reviewer PATCH that omits `models` returns `400`.

### Get results / leaderboard

Requires scope `batches:read`. Returns `422` if the batch has no completed evaluations.

```bash
curl "http://localhost:3000/api/v1/batches/{batchId}/results?include_original_models=true" \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK**
```json
{
  "data": {
    "leaderboard": [
      {"model": "model_a", "avg_rank": 1.2, "avg_rate": 4.5, "overall_rank": 1, "rank": {"1": 8, "2": 2}, "rate": {"4": 4, "5": 6}},
      {"model": "model_b", "avg_rank": 1.8, "avg_rate": 3.2, "overall_rank": 2, "rank": {"1": 2, "2": 8}, "rate": {"3": 6, "4": 4}}
    ],
    "summary": {"total_tasks": 10, "annotated_tasks": 10, "reviewed_tasks": 5, "avg_annotation_time_ms": 4200}
  }
}
```

### Export batch data

Every exported task carries an explicit `export_action` of `"keep"` or `"drop"`,
derived from the reviewer's `excluded` flag. Excluded segments are **not** removed
from the export: dropping them would make the file disagree with the batch and
hide the reviewer's decisions. A corpus builder filters on `export_action` and can
still audit what was dropped and why (`reviewer_comment` travels with the row).

JSON exports also carry an `export_summary` of `{total_tasks, keep, drop}`.

For TTS voice-collection batches, CSV is one row per prompt
(`task_id, text, audio_file_id, export_action, excluded, reviewer_comment,
reviewed_at, active_duration_ms`) rather than one row per task-model, since those
tasks carry no model outputs.


Requires scope `batches:read`.

```bash
# JSON export
curl "http://localhost:3000/api/v1/batches/{batchId}/export?format=json&include_original_models=true" \
  -H "Authorization: Bearer heval_your_key" \
  -o batch-export.json

# CSV export (one row per task-model)
curl "http://localhost:3000/api/v1/batches/{batchId}/export?format=csv" \
  -H "Authorization: Bearer heval_your_key" \
  -o batch-export.csv
```

### Delete batch

Requires scope `batches:write` (creator or root).

```bash
curl -X DELETE http://localhost:3000/api/v1/batches/{batchId} \
  -H "Authorization: Bearer heval_your_key"
```

**204 No Content**

---

## 4. User Management

### Who am I

No scope required.

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK**
```json
{"data": {"email": "user@example.com", "full_name": "Test User", "role": "user"}}
```

### List all users (root only)

Requires scope `users:read` **and** a root caller.

```bash
curl "http://localhost:3000/api/v1/users?limit=50" \
  -H "Authorization: Bearer heval_your_key"
```

### Update user role (root only)

Requires scope `users:write` **and** a root caller.

```bash
curl -X PATCH http://localhost:3000/api/v1/users/user@example.com \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"role": "root"}'
```

### Deactivate a user (root only)

```bash
curl -X PATCH http://localhost:3000/api/v1/users/user@example.com \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

> Deactivating a user immediately disables their API keys as well (keys resolve the owner's live state on each request).

---

## 5. Presence

Requires scope `presence:read`.

### Query annotator status

```bash
curl "http://localhost:3000/api/v1/presence?usernames=ann1@test.com,ann2@test.com&batch_id=batch-001" \
  -H "Authorization: Bearer heval_your_key"
```

**200 OK**
```json
{
  "data": {
    "ann1@test.com": {"status": "active", "batch_id": "batch-001"},
    "ann2@test.com": {"status": "away", "batch_id": "batch-001"}
  }
}
```

Status values: `active` (heartbeat < 45s), `idle` (< 180s), `away` (>= 180s).

---

## 6. Webhooks

### Register a webhook

Requires scope `webhooks:write`.

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer heval_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/horneval",
    "events": ["batch.created", "batch.completed", "task.evaluated"],
    "secret": "your-webhook-secret"
  }'
```

**201 Created**
```json
{"data": {"webhook_id": "a1b2c3d4-...", "url": "https://your-app.com/webhooks/horneval", "events": [...], "created_at": "..."}}
```

Valid events: `batch.created`, `batch.assigned`, `batch.completed`, `tasks.appended`, `task.evaluated`, `review.submitted`.

Payloads are signed with HMAC-SHA256. Verify via the `X-HornEval-Signature` header using your secret.

Delivery is **authorization-scoped**: a webhook only receives events for batches its owner is allowed to see (creator, annotator, or reviewer). Root-owned webhooks receive all matching events.

### List your webhooks

Requires scope `webhooks:read`.

```bash
curl http://localhost:3000/api/v1/webhooks \
  -H "Authorization: Bearer heval_your_key"
```

### Delete a webhook

Requires scope `webhooks:write`.

```bash
curl -X DELETE http://localhost:3000/api/v1/webhooks/{webhookId} \
  -H "Authorization: Bearer heval_your_key"
```

**204 No Content**
