import json
import os
# pyrefly: ignore [missing-import]
import google.generativeai as genai
from app.contracts.models import StoryContext, StoryPlan

class StoryPlanningAgent:
    def __init__(self):
        # Configure the Gemini API
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def plan_story(self, context: StoryContext) -> StoryPlan:
        prompt = self._build_prompt(context)
        
        # We enforce JSON output formatting
        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                # pyrefly: ignore [unexpected-keyword]
                response_mime_type="application/json",
            ),
        )
        
        try:
            # Parse the JSON string from Gemini
            data = json.loads(response.text)
            
            # Use Pydantic to validate and construct the object
            plan = StoryPlan.model_validate(data)
            return plan
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Gemini response as JSON: {e}\nResponse: {response.text}")
        except Exception as e:
            raise ValueError(f"Validation failed for StoryPlan: {e}\nResponse: {response.text}")

    def _build_prompt(self, context: StoryContext) -> str:
        return f"""
You are a master children's storyteller. Please plan a story for a {context.targetAge}-year-old child.
The theme is: "{context.theme}".
The Social-Emotional Learning (SEL) goal is: "{context.selGoal}".
The reading level should be: "{context.readingLevel}".
Language: {context.language}

Your task is to return a JSON object that matches the following structure exactly.
Do not wrap it in markdown block quotes.

{{
  "title": "string",
  "characters": [
    {{
      "name": "string",
      "role": "string",
      "description": "string"
    }}
  ],
  "conflict": "string",
  "resolution": "string",
  "selGoals": ["string"],
  "pageCount": {context.pageCount or 5}
}}
"""
