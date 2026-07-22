from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Any

from ..contracts.validation_result import ValidationResult

class BaseAgent(ABC):
    """Common behavior for all AI agents.

    Sub‑classes must implement :meth:`execute` which performs the core logic.
    The default :meth:`validate` simply returns a successful ``ValidationResult``
    and can be overridden for custom validation of the input model.
    """

    @abstractmethod
    def execute(self, *args: Any, **kwargs: Any) -> BaseModel:
        """Run the agent's main logic and return a Pydantic model."""

    def validate(self, input_model: BaseModel) -> ValidationResult:
        """Validate *input_model*.
        Override to add domain‑specific checks. The default implementation
        always returns ``is_valid=True`` with an empty error list.
        """
        return ValidationResult(is_valid=True, errors=[])

    def handle_error(self, error: Exception) -> None:
        """Central error handling hook – subclasses may override.
        The default simply re‑raises the exception.
        """
        raise error
