"""Client tests against a fake transport — no server, no network."""

import json

import pytest

from horneval import (
    AuthError,
    ConflictError,
    HornEval,
    HornEvalError,
    NotFoundError,
    ValidationError,
)


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.ok = 200 <= status_code < 300

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    """Records requests and replays a queue of canned responses."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, params=None, json=None, headers=None, timeout=None):
        self.calls.append(
            {
                "method": method,
                "url": url,
                "params": params,
                "json": json,
                "headers": headers or {},
            }
        )
        return self.responses.pop(0)


def make_client(responses):
    session = FakeSession(responses)
    client = HornEval(
        base_url="https://horneval.test/",
        api_key="heval_testkey",
        session=session,
    )
    return client, session


def ok(data, status=200):
    return FakeResponse(status, {"data": data})


def err(status, code, message, details=None):
    return FakeResponse(status, {"error": {"code": code, "message": message, "details": details}})


class TestConstruction:
    def test_requires_base_url(self, monkeypatch):
        monkeypatch.delenv("HORNEVAL_URL", raising=False)
        with pytest.raises(ValueError):
            HornEval(api_key="heval_x")

    def test_requires_api_key(self, monkeypatch):
        monkeypatch.delenv("HORNEVAL_API_KEY", raising=False)
        with pytest.raises(ValueError):
            HornEval(base_url="https://horneval.test")

    def test_reads_environment(self, monkeypatch):
        monkeypatch.setenv("HORNEVAL_URL", "https://env.test")
        monkeypatch.setenv("HORNEVAL_API_KEY", "heval_env")
        client = HornEval()
        assert client.base_url == "https://env.test"
        assert client.api_key == "heval_env"

    def test_strips_trailing_slash(self):
        client, _ = make_client([])
        assert client.base_url == "https://horneval.test"


class TestRequests:
    def test_sends_bearer_token_and_unwraps_data(self):
        client, session = make_client([ok({"batch_id": "b1"})])
        result = client.get_batch("b1")

        assert result == {"batch_id": "b1"}
        call = session.calls[0]
        assert call["url"] == "https://horneval.test/api/v1/batches/b1"
        assert call["headers"]["Authorization"] == "Bearer heval_testkey"

    def test_create_batch_omits_unset_fields(self):
        client, session = make_client([ok({"batch_id": "b1"}, status=201)])
        client.create_batch(
            "tts",
            "voices-01",
            "general",
            [{"id": "1", "input": "ሰላም"}],
            language={"iso_639_3": "tir", "iso_name": "Tigrinya"},
            workflow="annotation",
        )

        body = session.calls[0]["json"]
        assert body["workflow"] == "annotation"
        assert body["dataset_type"] == "tts"
        # MT-only fields must not leak into a TTS payload
        assert "source_language" not in body
        assert "target_language" not in body

    def test_append_tasks_sends_idempotency_key(self):
        client, session = make_client([ok({"appended": 1}, status=201)])
        client.append_tasks("b1", [{"id": "3", "input": "ጽሑፍ"}], idempotency_key="key-1")

        call = session.calls[0]
        assert call["url"] == "https://horneval.test/api/v1/batches/b1/tasks"
        assert call["json"] == {"tasks": [{"id": "3", "input": "ጽሑፍ"}]}
        assert call["headers"]["Idempotency-Key"] == "key-1"

    def test_append_tasks_accepts_any_iterable(self):
        client, session = make_client([ok({"appended": 2}, status=201)])
        client.append_tasks("b1", (t for t in [{"id": "3"}, {"id": "4"}]))
        assert session.calls[0]["json"]["tasks"] == [{"id": "3"}, {"id": "4"}]

    def test_update_task_passes_reference_for_annotation(self):
        client, session = make_client([ok({"message": "Task updated."})])
        client.update_task("b1", "1", reference="file_abc")
        assert session.calls[0]["json"] == {"reference": "file_abc"}

    def test_export_includes_original_models_only_when_asked(self):
        client, session = make_client([ok({}), ok({})])
        client.export_batch("b1")
        assert "include_original_models" not in session.calls[0]["params"]

        client.export_batch("b1", include_original_models=True)
        assert session.calls[1]["params"]["include_original_models"] == "true"


class TestPagination:
    def test_list_batches_follows_the_cursor(self):
        client, session = make_client(
            [
                ok({"data": [{"batch_id": "b1"}], "pagination": {"has_more": True, "next_cursor": "c1"}}),
                ok({"data": [{"batch_id": "b2"}], "pagination": {"has_more": False, "next_cursor": None}}),
            ]
        )

        batches = list(client.list_batches("tts"))

        assert [b["batch_id"] for b in batches] == ["b1", "b2"]
        assert session.calls[0]["params"].get("cursor") is None
        assert session.calls[1]["params"]["cursor"] == "c1"

    def test_list_batches_stops_when_cursor_is_missing(self):
        client, _ = make_client(
            [ok({"data": [{"batch_id": "b1"}], "pagination": {"has_more": True, "next_cursor": None}})]
        )
        assert len(list(client.list_batches("tts"))) == 1

    def test_list_tasks_passes_status_filter(self):
        client, session = make_client(
            [ok({"data": [{"id": "1"}], "pagination": {"has_more": False, "next_cursor": None}})]
        )
        list(client.list_tasks("b1", status="pending"))
        assert session.calls[0]["params"]["status"] == "pending"


class TestErrors:
    @pytest.mark.parametrize(
        "status,code,expected",
        [
            (401, "UNAUTHORIZED", AuthError),
            (403, "FORBIDDEN", AuthError),
            (404, "NOT_FOUND", NotFoundError),
            (400, "VALIDATION_FAILED", ValidationError),
            (400, "RATE_RANK_INCONSISTENT", ValidationError),
            (409, "CONFLICT", ConflictError),
        ],
    )
    def test_maps_error_codes(self, status, code, expected):
        client, _ = make_client([err(status, code, "boom")])
        with pytest.raises(expected) as excinfo:
            client.get_batch("b1")
        assert excinfo.value.code == code
        assert excinfo.value.status == status

    def test_unknown_code_falls_back_to_base_error(self):
        client, _ = make_client([err(500, "SOMETHING_NEW", "boom")])
        with pytest.raises(HornEvalError):
            client.get_batch("b1")

    def test_conflict_on_duplicate_append_is_typed(self):
        client, _ = make_client(
            [err(409, "CONFLICT", "Task id(s) already present in batch 'b1': 3.")]
        )
        with pytest.raises(ConflictError) as excinfo:
            client.append_tasks("b1", [{"id": "3", "input": "x"}])
        assert "3" in excinfo.value.message

    def test_carries_validation_details(self):
        client, _ = make_client([err(400, "VALIDATION_FAILED", "bad", details=["A", "B"])])
        with pytest.raises(ValidationError) as excinfo:
            client.get_batch("b1")
        assert excinfo.value.details == ["A", "B"]

    def test_non_json_error_body(self):
        client, _ = make_client([FakeResponse(502, None)])
        with pytest.raises(HornEvalError):
            client.get_batch("b1")
