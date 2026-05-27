import wizardImg from "@/assets/wizard-narrator.webp";
import fairyImg from "@/assets/fairy-narrator.webp";
import robotImg from "@/assets/robot-narrator.webp";
import dragonImg from "@/assets/dragon-narrator.webp";
import alienImg from "@/assets/alien-narrator.webp";

interface NarratorAvatarProps {
  characterId: string;
  isSpeaking: boolean;
}

const NARRATOR_IMAGES: Record<string, string> = {
  wizard: wizardImg,
  fairy: fairyImg,
  robot: robotImg,
  dragon: dragonImg,
  alien: alienImg,
};

/**
 * Narrator avatar with a gentle bobbing motion while narration is active.
 */
const NarratorAvatar = ({ characterId, isSpeaking }: NarratorAvatarProps) => {
  const src = NARRATOR_IMAGES[characterId] ?? wizardImg;
  return (
    <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 select-none pointer-events-none">
      {/* soft magical glow behind narrator */}
      <div
        className={`absolute inset-0 rounded-full blur-2xl bg-gradient-to-br from-kids-softPurple via-kids-softYellow to-kids-softPink ${
          isSpeaking ? "animate-staff-glow" : "opacity-40"
        }`}
        aria-hidden="true"
      />
      <div className={`relative w-full h-full ${isSpeaking ? "animate-narrator-bob" : ""}`}>
        <img
          src={src}
          alt={`${characterId} narrator`}
          className="w-full h-full object-contain drop-shadow-xl"
          draggable={false}
        />
      </div>
    </div>
  );
};

export default NarratorAvatar;
