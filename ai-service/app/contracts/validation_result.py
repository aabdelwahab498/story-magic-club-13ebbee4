from pydantic import BaseModel, Field
from typing import List

class ValidationError(BaseModel):
    """Represents a single validation error."""
    field: str = Field(..., description="Name of the field that failed validation")
    message: str = Field(..., description="Human‑readable error message")

class ValidationResult(BaseModel):
    """Result of a validation step."""
    is_valid: bool = Field(..., description="True if validation passed")
    errors: List[ValidationError] = Field(default_factory=list, description="List of validation errors when is_valid is False")
