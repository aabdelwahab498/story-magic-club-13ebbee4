import najmahLogo from "@/assets/najmah-logo.png";

interface AnimatedLogoProps {
  className?: string;
  text?: string;
  animated?: boolean;
}

const AnimatedLogo = ({ className = "", text = "Najmah", animated = true }: AnimatedLogoProps) => {
  return (
    <span
      dir="ltr"
      className={`inline-flex items-center select-none ${className}`}
      aria-label={text}
    >
      <img
        src={najmahLogo}
        alt={text}
        className={`h-[1.6em] w-auto object-contain ${animated ? "animate-float" : ""} drop-shadow-lg`}
        draggable={false}
      />
    </span>
  );
};

export default AnimatedLogo;
