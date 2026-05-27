
import { Trophy, Star } from "lucide-react";

export interface Winner {
  id: number;
  title: string;
  artist: string;
  image: string;
  period: string;
  votes: number;
  prize: string;
}

interface WinnerCardProps {
  winner: Winner;
}

const WinnerCard = ({ winner }: WinnerCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="h-64 md:h-auto">
          <img 
            src={winner.image} 
            alt={winner.title} 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-6 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-xl text-kids-midnight">{winner.title}</h4>
              <p className="text-gray-600">by {winner.artist}</p>
            </div>
            <div className="bg-kids-yellow text-white p-2 rounded-full">
              <Trophy className="h-6 w-6" />
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-gray-500">{winner.period}</p>
            <div className="flex items-center mt-1">
              <Star className="h-5 w-5 text-kids-orange" />
              <span className="ml-1 font-medium">{winner.votes} votes</span>
            </div>
          </div>
          
          <div className="mt-auto">
            <div className="bg-kids-softGreen p-3 rounded-lg">
              <p className="font-medium text-kids-midnight">Prize Won:</p>
              <p className="text-kids-green font-bold">{winner.prize}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinnerCard;
