import { useTranslation } from "react-i18next";
import {
  NARRATOR_KEYS,
  NARRATOR_IMAGES,
  NARRATOR_COLORS,
  type NarratorId,
} from "@/lib/narrators";

interface NarratorPickerProps {
  value: NarratorId;
  onChange: (id: NarratorId) => void;
  size?: "sm" | "md";
  label?: string;
  className?: string;
  /** Stop event propagation on click (useful inside parent <button> cards) */
  stopPropagation?: boolean;
  /** Called when the user hovers an avatar (useful for voice preview) */
  onHover?: (id: NarratorId) => void;
}

/**
 * Compact row of 5 narrator avatars. Used in story cards and the story
 * detail panel to let the child pick which narrator reads the story aloud.
 */
const NarratorPicker = ({
  value,
  onChange,
  size = "sm",
  label,
  className = "",
  stopPropagation = false,
  onHover,
}: NarratorPickerProps) => {
  const { t } = useTranslation();
  const dim = size === "sm" ? "w-8 h-8" : "w-12 h-12";

  return (
    <div className={className}>
      {label && (
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
          {label}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {NARRATOR_KEYS.map((id) => {
          const active = value === id;
          const name = t(`ai.characters.${id}`);
          return (
            <button
              key={id}
              type="button"
              onClick={(e) => {
                if (stopPropagation) e.stopPropagation();
                onChange(id);
              }}
              onMouseEnter={() => onHover?.(id)}
              title={name}
              aria-label={name}
              aria-pressed={active}
              className={`${dim} rounded-full overflow-hidden border-2 transition-all hover:scale-110 ${
                active
                  ? "border-primary shadow-md scale-110 ring-2 ring-primary/30"
                  : "border-foreground/15 dark:border-white/30 opacity-80 hover:opacity-100"
              }`}
              style={active ? { backgroundColor: NARRATOR_COLORS[id] + "33" } : undefined}
            >
              <img
                src={NARRATOR_IMAGES[id]}
                alt={name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NarratorPicker;
