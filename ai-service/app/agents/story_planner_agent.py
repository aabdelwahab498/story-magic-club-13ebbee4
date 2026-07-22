from typing import List
from pydantic import BaseModel

from ..contracts.story_context import StoryContext
from ..contracts.story_plan import StoryPlan, Character
from .base_agent import BaseAgent

class StoryPlannerAgent(BaseAgent):
    """Deterministic mock implementation of the story planning agent.

    It receives a :class:`StoryContext` and produces a static :class:`StoryPlan`
    that follows the required schema. Real LLM integration will replace this
    method later.
    """

    def execute(self, *args, **kwargs) -> BaseModel:
        """Entry point required by BaseAgent.

        Delegates to ``plan_story`` which contains the actual logic.
        """
        if not args:
            raise ValueError("Missing StoryContext argument for execution")
        context = args[0]
        return self.plan_story(context)

    def plan_story(self, context: StoryContext) -> StoryPlan:
        """Validate the input and return a deterministic ``StoryPlan``.

        The validation step currently relies on the base ``validate`` method,
        which always succeeds. If validation were to fail a ``ValueError`` would
        be raised, propagating to the FastAPI endpoint where it becomes a
        ``422`` response.
        """
        # Simple validation – ensure required fields are present (pydantic does this)
        validation = self.validate(context)
        if not validation.is_valid:
            messages = ", ".join(err.message for err in validation.errors)
            raise ValueError(messages)

        # Deterministic mock data – can be adjusted as needed
        title = f"The Great {context.theme.title()} Adventure"
        characters: List[Character] = [
            Character(name="Hero", role="hero", description="Brave child protagonist"),
            Character(name="Mentor", role="mentor", description="Wise guide helping the hero"),
        ]
        conflict = f"The hero must overcome a challenge related to {context.selGoal}."
        resolution = "Through perseverance and guidance, the hero succeeds and learns the SEL lesson."
        sel_goals = [context.selGoal]

        return StoryPlan(
            title=title,
            characters=characters,
            conflict=conflict,
            resolution=resolution,
            selGoals=sel_goals,
        )


from ..contracts.story_context import StoryContext
from ..contracts.story_plan import StoryPlan, Character
from .base_agent import BaseAgent

from ..contracts.story_context import StoryContext
from ..contracts.story_plan import StoryPlan, Character
from .base_agent import BaseAgent

class StoryPlannerAgent(BaseAgent):
    """Deterministic mock implementation of the story planning agent.

    It receives a :class:`StoryContext` and produces a static :class:`StoryPlan`
    that follows the required schema. Real LLM integration will replace this
    method later.
    """

    def execute(self, *args, **kwargs) -> BaseModel:
        """Entry point required by BaseAgent.

        Delegates to ``plan_story`` which contains the actual logic.
        """
        # Expect the first positional argument to be a StoryContext
        if not args:
            raise ValueError("Missing StoryContext argument for execution")
        context = args[0]
        return self.plan_story(context)

    """Deterministic mock implementation of the story planning agent.

    It receives a :class:`StoryContext` and produces a static :class:`StoryPlan`
    that follows the required schema. Real LLM integration will replace this
    method later.
    """

    def plan_story(self, context: StoryContext) -> StoryPlan:
        """Validate the input and return a deterministic ``StoryPlan``.

        The validation step currently relies on the base ``validate`` method,
        which always succeeds. If validation were to fail a ``ValueError`` would
        be raised, propagating to the FastAPI endpoint where it becomes a
        ``422`` response.
        """
        # Simple validation – ensure required fields are present (pydantic does this)
        validation = self.validate(context)
        if not validation.is_valid:
            # Collect messages for all errors
            messages = ", ".join(err.message for err in validation.errors)
            raise ValueError(messages)

        # Deterministic mock data – can be adjusted as needed
        title = f"The Great {context.theme.title()} Adventure"
        characters: List[Character] = [
            Character(name="Hero", role="hero", description="Brave child protagonist"),
            Character(name="Mentor", role="mentor", description="Wise guide helping the hero"),
        ]
        conflict = f"The hero must overcome a challenge related to {context.selGoal}."
        resolution = "Through perseverance and guidance, the hero succeeds and learns the SEL lesson."
        sel_goals = [context.selGoal]

        return StoryPlan(
            title=title,
            characters=characters,
            conflict=conflict,
            resolution=resolution,
            selGoals=sel_goals,
        )
