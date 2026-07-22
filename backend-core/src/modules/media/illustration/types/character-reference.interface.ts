export interface CharacterReference {
  name: string;
  appearance: string; // e.g. "tall, green hair, wearing a red cape"
  age?: string;
  traits?: string[]; // e.g. ["brave", "curious"]
  colors?: string[]; // Primary colors associated with the character
}
