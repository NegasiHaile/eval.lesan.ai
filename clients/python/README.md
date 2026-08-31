# horneval (Python client)

Thin HTTP client for the HornEval API, for offline task-preparation pipelines.

It deliberately contains no validation logic of its own. The server validates
every batch and task with the same code the web UI uses, so a payload this
client accepts is exactly a payload the UI would accept — there is no second
schema to keep in sync.

## Install

```bash
pip install -e clients/python
```

## Authenticate

Create an API key while signed in to the webapp (there is no key-management UI
yet, so this is a session-authenticated call from the browser or curl):

```bash
curl -X POST https://horneval.example.com/api/v1/api-keys \
  -H 'Content-Type: application/json' \
  --cookie "$SESSION_COOKIE" \
  -d '{"name":"offline-prep","scopes":["batches:read","batches:write","tasks:read","tasks:write"]}'
```

The plaintext key is returned once. Then:

```bash
export HORNEVAL_URL=https://horneval.example.com
export HORNEVAL_API_KEY=heval_...
```

## TTS voice collection, end to end

The flywheel case: stand up a recording batch, hand it to an annotator, then
keep feeding it prompts as your pipeline produces them.

```python
from horneval import HornEval, ConflictError

client = HornEval()  # reads HORNEVAL_URL / HORNEVAL_API_KEY

# 1. Create the batch. workflow="annotation" means voice collection:
#    each task is a prompt to read aloud, and carries no models.
batch = client.create_batch(
    dataset_type="tts",
    batch_name="tir-voices-2026-08",
    dataset_domain="general",
    language={"iso_639_3": "tir", "iso_name": "Tigrinya"},
    workflow="annotation",
    tasks=[
        {"id": "p1", "input": "ሰላም ከመይ ኣለኻ።"},
        {"id": "p2", "input": "ጽቡቕ መዓልቲ።"},
    ],
)

# 2. Assign it so an annotator sees it under /tts.
client.assign_batch(batch["batch_id"], "annotator", "annotator@example.com")

# 3. Append more prompts later — the batch stays live while it is worked on.
client.append_tasks(
    batch["batch_id"],
    [{"id": "p3", "input": "ሓድሽ ምሳሌ ጽሑፍ።"}],
    idempotency_key="tir-voices-2026-08-chunk-3",
)

# 4. Track progress and pull the collected recordings.
for task in client.list_tasks(batch["batch_id"], status="completed"):
    # `reference` holds the uploaded audio's file_id; play it back at
    # /api/media/{file_id}, which signs a fresh URL per request.
    print(task["id"], task["reference"])
```

### Appending is all-or-nothing

If any task id already exists in the batch (or repeats within your payload),
nothing is written:

```python
try:
    client.append_tasks(batch_id, tasks)
except ConflictError as e:
    print("already ingested:", e.message)
```

Pass `idempotency_key` on every append. A retry after a lost response then
returns the original result instead of appending the same prompts twice.

Only the batch creator (or a root user) can append. An assigned annotator
cannot extend their own workload.

**Appended tasks appear on the annotator's next load of the batch, not
mid-session** — the TTS page fetches a batch's tasks once when it is selected.

## Discovering the schema

The server describes its own batch shapes, which is the authoritative reference
for `create_batch`:

```python
client.get_template("tts")["schema"]["example"]["annotation"]
```

## Other methods

`get_batch`, `list_batches` (auto-paginating), `delete_batch`, `get_task`,
`list_tasks` (auto-paginating), `update_task`, `assign_batch`,
`reassign_batch`, `unassign_batch`, `get_results`, `export_batch`, `whoami`.

Submitting results through `update_task`:

```python
# TTS annotation — the recording is the submission
client.update_task(batch_id, "p1", reference="file_abc123")

# Evaluation batches — rate and rank the model outputs
client.update_task(batch_id, "1", models=[
    {"model": "A", "rate": 5, "rank": 1},
    {"model": "B", "rate": 3, "rank": 2},
])
```

## Errors

All raise a subclass of `HornEvalError`, carrying the API's `code`, `status`,
and `details`: `AuthError` (401/403), `NotFoundError`, `ValidationError`
(including rate/rank inconsistency), `ConflictError`.

## Not supported yet: audio upload

`POST /api/uploads` accepts a session cookie only, not an API key, so this
client cannot upload audio. It is not needed for TTS voice collection — prompts
are text, and annotators record in the browser. Giving `/api/uploads` API-key
auth is the natural next step for ingesting audio from offline pipelines (ASR
batches, or pre-recorded TTS references).

## Tests

```bash
cd clients/python && python3 -m pytest tests -q
```

They run against a fake transport — no server or network required.
