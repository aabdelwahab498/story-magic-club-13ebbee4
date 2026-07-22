from pydantic import BaseModel, Field
from typing import Optional

class StoryContext(BaseModel):
    """Input data required to plan a story."""
    targetAge: int = Field(..., description="Age of the child target")
    language: str = Field(..., description="Language code, e.g., 'en', 'ar'")
    readingLevel: str = Field(..., description="Reading-level identifier, e.g., 'level_1'")
    theme: str = Field(..., description="Story theme, e.g., 'friendship'")
    selGoal: str = Field(..., description="SEL learning objective, e.g., 'confidence'")
    pageCount: Optional[int] = Field(None, description="Optional desired page count")
