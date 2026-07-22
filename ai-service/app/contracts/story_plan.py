from pydantic import BaseModel, Field
from typing import List

class Character(BaseModel):
    """A character participating in the story."""
    name: str = Field(..., description="Character name")
    role: str = Field(..., description="Role in the story, e.g., 'hero', 'mentor'")
    description: str = Field(..., description="Brief description of the character")

class StoryPlan(BaseModel):
    """Result of the story planning step."""
    title: str = Field(..., description="Story title")
    characters: List[Character] = Field(..., description="List of characters in the story")
    conflict: str = Field(..., description="Primary conflict of the story")
    resolution: str = Field(..., description="Resolution of the conflict")
    selGoals: List[str] = Field(..., description="SEL learning objectives for the story")
