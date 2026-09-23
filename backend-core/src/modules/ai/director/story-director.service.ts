import { Injectable, Logger } from '@nestjs/common';
import { StoryContract } from './story-contract.interface.js';

@Injectable()
export class StoryDirectorService {
  private readonly logger = new Logger(StoryDirectorService.name);

  /**
   * Derives a structured StoryContract from the parent's customPrompt and profile preferences.
   * Distinguishes HARD constraints (explicit parent directions) from SOFT constraints (theme/SEL enrichment).
   */
  deriveContract(
    customPrompt?: string,
    childName?: string,
    targetAge?: number,
  ): StoryContract {
    const rawPrompt = customPrompt?.trim();
    if (!rawPrompt) {
      return {
        hasCustomPrompt: false,
        protagonistName: childName,
        protagonistAge: targetAge,
        keyCharacters: [],
        keyObjects: [],
        requestedValues: [],
        hardConstraints: childName ? [`Protagonist name should be ${childName}`] : [],
        softConstraints: ['Incorporate theme and SEL goals into story pacing.'],
      };
    }

    // 1. Protagonist Name Extraction
    let protagonistName = childName;
    const nameMatch = rawPrompt.match(/about\s+([A-Z][a-z]+)/i) || rawPrompt.match(/\b([A-Z][a-z]+)\b,?\s+a\s+\d+[- ]year[- ]old/i);
    if (nameMatch && nameMatch[1]) {
      const extractedName = nameMatch[1];
      const excludedWords = new Set(['Write', 'Create', 'Tell', 'A', 'An', 'The', 'In', 'On', 'Once']);
      if (!excludedWords.has(extractedName)) {
        protagonistName = extractedName;
      }
    }

    // 2. Protagonist Age Extraction
    let protagonistAge = targetAge;
    const ageMatch = rawPrompt.match(/(\d+)[- ]year[- ]old/i);
    if (ageMatch && ageMatch[1]) {
      protagonistAge = parseInt(ageMatch[1], 10);
    }

    // 3. Key Objects and Characters Extraction
    const keyObjects: string[] = [];
    const keyCharacters: string[] = [];

    const lowerPrompt = rawPrompt.toLowerCase();
    if (lowerPrompt.includes('star') || lowerPrompt.includes('glowing star')) {
      keyObjects.push('star');
      keyObjects.push('glowing star');
    }
    if (lowerPrompt.includes('dragon')) keyCharacters.push('dragon');
    if (lowerPrompt.includes('magic') || lowerPrompt.includes('wand')) keyObjects.push('magic');

    // 4. Central Premise & Ending Requirements
    let centralPremise = rawPrompt;
    let endingRequirement: string | undefined;

    if (lowerPrompt.includes('return') || lowerPrompt.includes('returns') || lowerPrompt.includes('sky')) {
      endingRequirement = 'returns to the sky / finds way home';
    }

    // 5. Requested Values / Lessons
    const requestedValues: string[] = [];
    ['courage', 'kindness', 'helping others', 'overcoming fear', 'sharing', 'honesty', 'friendship'].forEach((val) => {
      if (lowerPrompt.includes(val)) {
        requestedValues.push(val);
      }
    });

    // 6. Hard & Soft Constraints Construction
    const hardConstraints: string[] = [];
    if (protagonistName) {
      hardConstraints.push(`Main protagonist must be named "${protagonistName}". Do not rename or substitute.`);
    }
    if (keyObjects.length > 0) {
      hardConstraints.push(`Key elements must be present: ${keyObjects.join(', ')}.`);
    }
    if (endingRequirement) {
      hardConstraints.push(`Ending requirement: ${endingRequirement}.`);
    }
    hardConstraints.push(`Central story premise: ${rawPrompt}.`);

    const softConstraints: string[] = [
      'Blend SEL goals smoothly into the narrative without replacing the primary brief.',
    ];

    this.logger.log(
      `Derived StoryContract for custom prompt (Protagonist: ${protagonistName || 'N/A'}, Key Objects: ${keyObjects.join(', ') || 'None'})`,
    );

    return {
      hasCustomPrompt: true,
      rawPrompt,
      protagonistName,
      protagonistAge,
      keyCharacters,
      keyObjects,
      setting: lowerPrompt.includes('garden') ? 'garden' : undefined,
      centralPremise,
      endingRequirement,
      requestedValues,
      hardConstraints,
      softConstraints,
    };
  }
}
