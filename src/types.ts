
export interface Story {
  id: number;
  title: string;
  image: string;
  audioSrc: string;
  description: string;
  age: string;
  duration: string;
  favorite: boolean;
}

export interface CharacterOption {
  id: string;
  name: string;
  color: string;
}

export interface ThemeOption {
  id: string;
  label: string;
}

export interface AgeRangeOption {
  id: string;
  label: string;
}

export interface StoryLengthOption {
  id: string;
  label: string;
}

export interface DrawingEntry {
  id: number;
  title: string;
  artist: string;
  image: string;
  votes: number;
  submitted: string;
}

export interface Winner {
  id: number;
  title: string;
  artist: string;
  image: string;
  period: string;
  votes: number;
  prize: string;
}
