
import { Heart } from "lucide-react";

export interface DrawingEntry {
  id: number;
  title: string;
  artist: string;
  image: string;
  votes: number;
  submitted: string;
}

interface DrawingEntryCardProps {
  entry: DrawingEntry;
  isVoted: boolean;
  onVote: (id: number) => void;
}

const DrawingEntryCard = ({ entry, isVoted, onVote }: DrawingEntryCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all">
      <div className="h-48 overflow-hidden">
        <img 
          src={entry.image} 
          alt={entry.title} 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h4 className="font-bold text-kids-midnight">{entry.title}</h4>
        <p className="text-gray-600 text-sm">by {entry.artist}</p>
        
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-gray-500">{entry.submitted}</span>
          <button 
            onClick={() => onVote(entry.id)}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
              isVoted
                ? 'bg-kids-red text-white'
                : 'bg-gray-100 hover:bg-kids-softPink'
            }`}
          >
            <Heart className={`h-4 w-4 ${isVoted ? 'fill-white' : ''}`} />
            <span>{isVoted ? entry.votes + 1 : entry.votes}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawingEntryCard;
