"""Exceptions mapped from the API's error envelope."""


class HornEvalError(Exception):
    """Base error. Carries the API's error code and details when present."""

    def __init__(self, message, *, code=None, status=None, details=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.details = details

    def __str__(self):
        return f"[{self.code or self.status}] {self.message}"


class AuthError(HornEvalError):
    """The API key is missing, invalid, or lacks the required scope."""


class NotFoundError(HornEvalError):
    """The batch, task, or user does not exist."""


class ValidationError(HornEvalError):
    """The payload was rejected. `details` holds the offending fields."""


class ConflictError(HornEvalError):
    """A duplicate batch name, or task ids already present in the batch."""


# Envelope error codes -> exception classes. Anything unlisted raises the base
# HornEvalError, so a new server-side code degrades gracefully.
CODE_MAP = {
    "UNAUTHORIZED": AuthError,
    "FORBIDDEN": AuthError,
    "NOT_FOUND": NotFoundError,
    "VALIDATION_FAILED": ValidationError,
    "RATE_RANK_INCONSISTENT": ValidationError,
    "CONFLICT": ConflictError,
}


def error_from_response(status, payload):
    """Build the right exception from a non-2xx response body."""
    error = (payload or {}).get("error") or {}
    code = error.get("code")
    message = error.get("message") or f"Request failed with status {status}."
    cls = CODE_MAP.get(code, HornEvalError)
    return cls(message, code=code, status=status, details=error.get("details"))
