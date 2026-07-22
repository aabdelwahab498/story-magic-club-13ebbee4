import pytest
from app.contracts.story_context import StoryContext
from app.contracts.story_plan import StoryPlan, Character

def test_story_context_creation():
    ctx = StoryContext(
        targetAge=7,
        language='en',
        readingLevel='level_1',
        theme='space',
        selGoal='courage',
        pageCount=10,
    )
    assert ctx.targetAge == 7
    assert ctx.language == 'en'
    assert ctx.selGoal == 'courage'
    assert ctx.pageCount == 10

def test_story_plan_structure():
    char = Character(name='Hero', role='hero', description='A brave child')
    plan = StoryPlan(
        title='Adventure',
        characters=[char],
        conflict='A problem',
        resolution='Solution',
        selGoals=['courage']
    )
    assert isinstance(plan, StoryPlan)
    assert plan.title == 'Adventure'
    assert plan.characters[0].name == 'Hero'
