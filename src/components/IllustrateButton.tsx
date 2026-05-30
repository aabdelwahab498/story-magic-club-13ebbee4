// Presentational button used by AIStoryteller to trigger user-only illustration
// generation. Extracted so we can unit-test its enabled/disabled state and
// the readiness badge in isolation without mounting the full page.
//
// Function B contract: this button must ONLY fire from a real user click —
// the parent passes the callback in. The component itself does no work
// beyond rendering state.
import { Crown, Loader2 } from "lucide-react";
import type { TFunction } from "i18next";

export interface IllustrateButtonProps {
  /** Number of images currently generated/ready. */
  count: number;
  /** True while generation is in flight. */
  illustrating: boolean;
  /** User click handler. Parent decides what to invoke. */
  onClick: () => void;
  /** i18n translator from `useTranslation()`. */
  t: TFunction;
  /** Optional className passthrough. */
  className?: string;
}

/**
 * Renders the "Illustrate & Download" button + readiness subtitle.
 *
 * Enabled when: `!illustrating && count === 0` (no work running, nothing ready).
 * Disabled when: generation is in flight OR images are already ready.
 * The readiness badge reflects the current count in real time.
 */
export const IllustrateButton = ({
  count,
  illustrating,
  onClick,
  t,
  className,
}: IllustrateButtonProps) => {
  const ready = count > 0;
  const disabled = illustrating || ready;

  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ""}`}>
      <button
        type="button"
        data-testid="ai-illustrate-button"
        data-illustrating={illustrating ? "true" : "false"}
        data-count={count}
        data-ready={ready ? "true" : "false"}
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        className="px-6 py-3 bg-gradient-to-r from-amber-400 to-pink-500 text-white rounded-full font-bold shadow hover:shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {illustrating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Crown className="h-4 w-4" />
        )}
        {ready
          ? t("page_ai_storyteller.illustrations_ready", "Illustrations ready")
          : t("page_ai_storyteller.illustrate_download", "Illustrate & Download")}
      </button>
      <span
        data-testid="ai-illustration-readiness-badge"
        data-count={count}
        className="text-[11px] text-foreground/60 dark:text-white/60"
        aria-live="polite"
      >
        {illustrating
          ? t("page_ai_storyteller.illustrations_pending_short", "Generating images…")
          : ready
          ? t(
              "page_ai_storyteller.illustrations_ready_short",
              `${count} images ready`,
            )
          : t(
              "page_ai_storyteller.illustrations_not_ready_short",
              "Tap to generate images",
            )}
      </span>
    </div>
  );
};

export default IllustrateButton;
