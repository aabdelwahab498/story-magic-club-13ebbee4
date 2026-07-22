from typing import List, Optional
from pydantic import BaseModel

class StoryContext(BaseModel):
    targetAge: int
    language: str
    readingLevel: str
    theme: str
    selGoal: str
    pageCount: Optional[int] = None

class Character(BaseModel):
    name: str
    role: str
    description: str

class StoryPlan(BaseModel):
    title: str
    characters: List[Character]
    conflict: str
    resolution: str
    selGoals: List[str]
    pageCount: int

class StoryPage(BaseModel):
    pageNumber: int
    text: str

class GeneratedStoryMetadata(BaseModel):
    theme: str
    selGoal: str

class GeneratedStory(BaseModel):
    title: str
    pages: List[StoryPage]
    metadata: GeneratedStoryMetadata

class ValidationResult(BaseModel):
    valid: bool
    errors: List[str]
    warnings: List[str]
