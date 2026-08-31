"""Thin HTTP client for the HornEval API.

Deliberately thin: the server owns all validation, so this module does not
re-implement batch or task rules. Anything the webapp rejects, this rejects too,
and there is no schema here to drift out of sync.
"""

import os
import json as _json

import requests

from .errors import HornEvalError, error_from_response

DEFAULT_TIMEOUT = 30


class HornEval:
    """A HornEval API client.

    Args:
        base_url: Root of the deployment, e.g. "https://horneval.example.com".
            Defaults to the HORNEVAL_URL environment variable.
        api_key: An API key ("heval_..."). Defaults to HORNEVAL_API_KEY.
        timeout: Per-request timeout in seconds.
    """

    def __init__(self, base_url=None, api_key=None, timeout=DEFAULT_TIMEOUT, session=None):
        base_url = base_url or os.environ.get("HORNEVAL_URL")
        api_key = api_key or os.environ.get("HORNEVAL_API_KEY")

        if not base_url:
            raise ValueError("base_url is required (or set HORNEVAL_URL).")
        if not api_key:
            raise ValueError("api_key is required (or set HORNEVAL_API_KEY).")

        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.session = session or requests.Session()

    # ── transport ────────────────────────────────────────────────────

    def _request(self, method, path, *, params=None, json=None, idempotency_key=None):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
        if json is not None:
            headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        response = self.session.request(
            method,
            f"{self.base_url}/api/v1{path}",
            params=params,
            json=json,
            headers=headers,
            timeout=self.timeout,
        )

        try:
            payload = response.json()
        except (ValueError, _json.JSONDecodeError):
            payload = None

        if not response.ok:
            raise error_from_response(response.status_code, payload)

        if payload is None:
            raise HornEvalError(
                "Expected a JSON response.", status=response.status_code
            )

        # Successful responses are wrapped as {"data": ...}
        return payload.get("data", payload)

    # ── batches ──────────────────────────────────────────────────────

    def create_batch(
        self,
        dataset_type,
        batch_name,
        dataset_domain,
        tasks,
        *,
        language=None,
        source_language=None,
        target_language=None,
        workflow=None,
        rating_guideline=None,
        domains=None,
        idempotency_key=None,
    ):
        """Create a batch.

        MT batches need source_language and target_language; ASR and TTS need
        language. TTS additionally requires workflow ("annotation" for voice
        collection, "evaluation" for model comparison).
        """
        body = {
            "dataset_type": dataset_type,
            "batch_name": batch_name,
            "dataset_domain": dataset_domain,
            "tasks": tasks,
        }
        if language is not None:
            body["language"] = language
        if source_language is not None:
            body["source_language"] = source_language
        if target_language is not None:
            body["target_language"] = target_language
        if workflow is not None:
            body["workflow"] = workflow
        if rating_guideline is not None:
            body["rating_guideline"] = rating_guideline
        if domains is not None:
            body["domains"] = domains

        return self._request(
            "POST", "/batches", json=body, idempotency_key=idempotency_key
        )

    def append_tasks(self, batch_id, tasks, *, idempotency_key=None):
        """Append tasks to an existing batch.

        The append is all-or-nothing: if any task id is already in the batch, or
        repeats within `tasks`, nothing is written and ConflictError is raised.
        Pass idempotency_key so a retry after a lost response cannot double-append.
        """
        return self._request(
            "POST",
            f"/batches/{batch_id}/tasks",
            json={"tasks": list(tasks)},
            idempotency_key=idempotency_key,
        )

    def get_batch(self, batch_id):
        return self._request("GET", f"/batches/{batch_id}")

    def list_batches(self, dataset_type, *, status=None, annotator_id=None, qa_id=None, limit=100):
        """Yield every batch of a dataset type, following the cursor."""
        cursor = None
        while True:
            params = {"dataset_type": dataset_type, "limit": limit}
            if status:
                params["status"] = status
            if annotator_id:
                params["annotator_id"] = annotator_id
            if qa_id:
                params["qa_id"] = qa_id
            if cursor:
                params["cursor"] = cursor

            page = self._request("GET", "/batches", params=params)
            for batch in page.get("data", []):
                yield batch

            pagination = page.get("pagination") or {}
            cursor = pagination.get("next_cursor")
            if not pagination.get("has_more") or not cursor:
                return

    def assign_batch(self, batch_id, role, email):
        """Assign a batch. role is "annotator" or "reviewer"."""
        return self._request(
            "POST",
            f"/batches/{batch_id}/assign",
            json={"role": role, "email": email},
        )

    def reassign_batch(self, batch_id, role, email):
        return self._request(
            "PUT",
            f"/batches/{batch_id}/assign",
            json={"role": role, "email": email},
        )

    def unassign_batch(self, batch_id, role):
        return self._request("DELETE", f"/batches/{batch_id}/assign/{role}")

    def delete_batch(self, batch_id):
        return self._request("DELETE", f"/batches/{batch_id}")

    # ── tasks ────────────────────────────────────────────────────────

    def list_tasks(self, batch_id, *, status=None, limit=100):
        """Yield every task in a batch, following the cursor.

        status is one of "pending", "completed", "reviewed".
        """
        cursor = None
        while True:
            params = {"limit": limit}
            if status:
                params["status"] = status
            if cursor:
                params["cursor"] = cursor

            page = self._request("GET", f"/batches/{batch_id}/tasks", params=params)
            for task in page.get("data", []):
                yield task

            pagination = page.get("pagination") or {}
            cursor = pagination.get("next_cursor")
            if not pagination.get("has_more") or not cursor:
                return

    def get_task(self, batch_id, task_id):
        return self._request("GET", f"/batches/{batch_id}/tasks/{task_id}")

    def update_task(self, batch_id, task_id, **fields):
        """Submit a task result.

        Evaluation batches take models=[{"model": ..., "rate": ..., "rank": ...}].
        TTS annotation batches take reference="<file_id>" and no models.
        """
        return self._request("PATCH", f"/batches/{batch_id}/tasks/{task_id}", json=fields)

    # ── results ──────────────────────────────────────────────────────

    def get_results(self, batch_id):
        return self._request("GET", f"/batches/{batch_id}/results")

    def export_batch(self, batch_id, *, format="json", include_original_models=False):
        params = {"format": format}
        if include_original_models:
            params["include_original_models"] = "true"
        return self._request("GET", f"/batches/{batch_id}/export", params=params)

    # ── discovery ────────────────────────────────────────────────────

    def get_template(self, dataset_type):
        """The server's own description of a batch shape — the source of truth
        for what create_batch accepts."""
        return self._request("GET", f"/templates/{dataset_type}")

    def whoami(self):
        return self._request("GET", "/users/me")
