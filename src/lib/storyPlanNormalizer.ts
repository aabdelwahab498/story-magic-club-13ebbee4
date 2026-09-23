export interface NormalizedStoryCharacter {
  name: string;
  role: string;
  description: string;
}

export interface NormalizedStoryPlan {
  title: string;
  characters: NormalizedStoryCharacter[];
  hero: {
    name: string;
    sense: string;
    problem: string;
    engine: string;
    charm: string;
  };
  companion?: {
    name: string;
    role: string;
  };
  mentor?: {
    name: string;
    role: string;
  };
  acts: {
    act1_normalWorld: string;
    act2_disturbance: string;
    act3_attempts: string[];
    act4_resolution: string;
  };
  selOutcome: {
    skill: string;
    emotion: string;
    statement: string;
  };
  conflict: string;
  resolution: string;
  selGoals: string[];
  pageCount: number;
}

export function normalizeStoryPlan(rawPlan: any, fallbackHeroName: string = 'Hero'): NormalizedStoryPlan {
  const plan = rawPlan?.blueprint || rawPlan?.data || rawPlan?.plan || rawPlan || {};

  const rawChars: any[] = Array.isArray(plan.characters) ? plan.characters : [];
  const characters: NormalizedStoryCharacter[] = rawChars.map((c) => ({
    name: String(c?.name || 'Character'),
    role: String(c?.role || 'character'),
    description: String(c?.description || 'A story character'),
  }));

  const heroChar =
    characters.find((c) => c.role?.toLowerCase() === 'hero') ||
    characters[0] || { name: fallbackHeroName, role: 'hero', description: 'Hero of the story' };

  const companionChar =
    characters.find((c) => c.role?.toLowerCase() === 'companion') ||
    (characters.length > 1 && characters[0] !== characters[1] ? characters[1] : undefined);

  const mentorChar = characters.find((c) => c.role?.toLowerCase() === 'mentor');

  const title = String(plan.title || 'Magical Story Preview');
  const conflict = String(plan.conflict || plan.acts?.act2_disturbance || 'A new adventure begins.');
  const resolution = String(
    plan.resolution ||
    (Array.isArray(plan.acts?.act3_attempts) ? plan.acts.act3_attempts.join(' → ') : '') ||
    plan.acts?.act4_resolution ||
    'The adventure concludes happily.'
  );

  const selGoals = Array.isArray(plan.selGoals)
    ? plan.selGoals.map(String)
    : plan.selOutcome?.skill
      ? [String(plan.selOutcome.skill)]
      : ['Empathy'];

  const hero = {
    name: String(plan.hero?.name || heroChar.name || fallbackHeroName),
    sense: String(plan.hero?.sense || heroChar.description || 'Sense'),
    problem: String(plan.hero?.problem || conflict),
    engine: String(plan.hero?.engine || 'Engine'),
    charm: String(plan.hero?.charm || heroChar.description || 'Charming hero'),
  };

  const companion = companionChar || plan.companion?.name
    ? {
        name: String(plan.companion?.name || companionChar?.name || 'Companion'),
        role: String(plan.companion?.role || companionChar?.description || companionChar?.role || 'Companion'),
      }
    : undefined;

  const mentor = mentorChar || plan.mentor?.name
    ? {
        name: String(plan.mentor?.name || mentorChar?.name || 'Mentor'),
        role: String(plan.mentor?.role || mentorChar?.description || mentorChar?.role || 'Mentor'),
      }
    : undefined;

  const acts = {
    act1_normalWorld: String(
      plan.acts?.act1_normalWorld || `Introduction of ${hero.name}.`
    ),
    act2_disturbance: String(plan.acts?.act2_disturbance || conflict),
    act3_attempts: Array.isArray(plan.acts?.act3_attempts)
      ? plan.acts.act3_attempts.map(String)
      : [resolution],
    act4_resolution: String(plan.acts?.act4_resolution || `Resolution: ${resolution}`),
  };

  const selOutcome = {
    skill: String(plan.selOutcome?.skill || selGoals[0] || 'Empathy'),
    emotion: String(plan.selOutcome?.emotion || 'Connected'),
    statement: String(
      plan.selOutcome?.statement || `Learned about ${selGoals.join(', ')}.`
    ),
  };

  return {
    title,
    characters,
    hero,
    companion,
    mentor,
    acts,
    selOutcome,
    conflict,
    resolution,
    selGoals,
    pageCount: typeof plan.pageCount === 'number' ? plan.pageCount : 11,
  };
}
