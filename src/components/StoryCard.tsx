
import { BookOpen } from "lucide-react";
import { Story } from "../types";

interface StoryCardProps {
  story: Story;
  selected: boolean;
  onClick: () => void;
}

const StoryCard = ({ story, selected, onClick }: StoryCardProps) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition-transform hover:scale-105 ${
        selected ? 'ring-4 ring-kids-purple' : ''
      }`}
    >
      <div className="relative h-40">
        <img 
          src={story.image} 
          alt={story.title} 
          className="w-full h-full object-cover" 
        />
        {story.favorite && (
          <div className="absolute top-2 right-2 bg-kids-red p-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-bold">{story.title}</h4>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-gray-500">{story.duration}</span>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 text-kids-purple mr-1" />
            <span className="text-sm">Age: {story.age}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryCard;
