"""Python client for the HornEval annotation and evaluation API."""

from .client import HornEval
from .errors import (
    AuthError,
    ConflictError,
    HornEvalError,
    NotFoundError,
    ValidationError,
)

__all__ = [
    "HornEval",
    "HornEvalError",
    "AuthError",
    "NotFoundError",
    "ValidationError",
    "ConflictError",
]
__version__ = "0.1.0"
