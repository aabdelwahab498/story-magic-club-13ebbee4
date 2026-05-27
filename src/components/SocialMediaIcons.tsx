import { useSocialLinks, SOCIAL_PLATFORMS } from "@/hooks/useSocialLinks";
import { PLATFORM_CONFIG } from "./SocialIcons";
import { useSoundEffects } from "@/hooks/useSoundEffects";

interface Props {
  /** vertical = 2-column compact grid; horizontal = single row. Default vertical. */
  orientation?: "vertical" | "horizontal";
  size?: "sm" | "md";
  className?: string;
  /**
   * When true, ALL platform icons are rendered. Configured platforms link out
   * with a clean active style; unconfigured ones render as a muted placeholder.
   */
  showPlaceholders?: boolean;
}

/**
 * Compact social icons component.
 * - Vertical mode renders a 2-column grid (so 7 icons fit nicely beside the logo).
 * - Configured platforms appear active at rest, brand color on hover.
 */
const SocialMediaIcons = ({
  orientation = "vertical",
  size = "sm",
  className = "",
  showPlaceholders = false,
}: Props) => {
  const { links } = useSocialLinks();
  const { onMouseEnter, onClick } = useSoundEffects();

  const items = SOCIAL_PLATFORMS.map((p) => {
    const cfg = PLATFORM_CONFIG[p];
    const href = cfg.href(links[p]);
    return { platform: p, href, Icon: cfg.Icon, label: cfg.label, hoverClass: cfg.hoverClass };
  }).filter((x) => showPlaceholders || x.href);

  if (items.length === 0) return null;

  const dims = size === "md" ? "h-8 w-8" : "h-7 w-7";
  const iconDims = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const layout =
    orientation === "vertical"
      ? "grid grid-cols-2 gap-1 place-items-center"
      : "flex flex-row flex-wrap items-center justify-center gap-1";

  return (
    <div className={`${layout} ${className}`} role="list" aria-label="Social media">
      {items.map(({ platform, href, Icon, label, hoverClass }) => {
        const baseClasses = `inline-flex ${dims} items-center justify-center rounded-full transition-all duration-300`;

        if (!href) {
          return (
            <span
              key={platform}
              role="listitem"
              title={`${label} — not configured`}
              aria-label={`${label} (not configured)`}
              className={`${baseClasses} bg-muted/30 text-muted-foreground/40 cursor-not-allowed`}
            >
              <Icon className={iconDims} />
            </span>
          );
        }

        return (
          <a
            key={platform}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            role="listitem"
            onMouseEnter={onMouseEnter}
            onClick={onClick}
            className={`${baseClasses} bg-white dark:bg-card border border-kids-softPurple/40 dark:border-primary/30 text-foreground shadow-soft hover:scale-110 hover:shadow-md ${hoverClass}`}
          >
            <Icon className={iconDims} />
          </a>
        );
      })}
    </div>
  );
};

export default SocialMediaIcons;
