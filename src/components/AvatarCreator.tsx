
import { useState } from "react";

interface AvatarOption {
  id: string;
  name: string;
  color: string;
}

interface AvatarCreatorProps {
  options: AvatarOption[];
  selectedCharacter: AvatarOption;
  onSelect: (character: AvatarOption) => void;
}

const AvatarCreator = ({ options, selectedCharacter, onSelect }: AvatarCreatorProps) => {
  return (
    <div className="mb-8">
      <h4 className="font-semibold mb-3 text-kids-midnight">Choose your storyteller:</h4>
      <div className="flex flex-wrap gap-4">
        {options.map((character) => (
          <button
            key={character.id}
            onClick={() => onSelect(character)}
            className={`px-4 py-3 rounded-xl flex items-center gap-2 transition-all ${
              selectedCharacter.id === character.id 
                ? 'ring-2 ring-kids-purple shadow-md scale-105' 
                : 'hover:bg-gray-50'
            }`}
            style={{ 
              backgroundColor: selectedCharacter.id === character.id 
                ? `${character.color}20` 
                : 'white' 
            }}
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: character.color }}
            >
              <span className="text-white font-bold">{character.name[0]}</span>
            </div>
            <span className="font-medium">{character.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AvatarCreator;
