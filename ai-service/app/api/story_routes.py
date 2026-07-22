from fastapi import APIRouter, HTTPException, status
from app.contracts.story_context import StoryContext
from app.contracts.story_plan import StoryPlan
from app.agents.story_planner_agent import StoryPlannerAgent
from app.utils.metrics import increment_provider_failures, increment_generation_success
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
planning_agent = StoryPlannerAgent()

@router.post("/story/plan", response_model=StoryPlan, status_code=status.HTTP_200_OK)
async def plan_story(context: StoryContext):
    """
    Plan a story blueprint using the StoryPlanningAgent based on the given context.
    """
    try:
        logger.info(f"Received planning request for target age: {context.targetAge}")
        plan = planning_agent.plan_story(context)
        logger.info(f"Successfully generated story plan: {plan.title}")
        increment_generation_success()
        return plan
    except ValueError as ve:
        increment_provider_failures()
        logger.error(f"Validation error during story planning: {str(ve)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        increment_provider_failures()
        logger.error(f"Unexpected error during story planning: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during story planning."
        )
