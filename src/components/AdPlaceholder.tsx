/**
 * Sticky bottom advertisement placeholder.
 * Visual placeholder only — no ad scripts, no tracking.
 * Sits above the footer, full-width, max 90px tall, and never blocks
 * scrolling or clicks on the content behind it.
 */
const AdPlaceholder = () => {
  return (
    <div
      role="complementary"
      aria-label="Sponsored content area"
      className="sticky bottom-0 left-0 right-0 z-30 w-full pointer-events-none"
    >
      <div className="pointer-events-auto w-full max-h-[90px] min-h-[60px] flex items-center justify-center border-t border-border bg-muted/80 backdrop-blur-sm px-4 py-3 text-xs sm:text-sm font-medium text-muted-foreground">
        <span className="tracking-wide uppercase">Sponsored Content Area</span>
      </div>
    </div>
  );
};

export default AdPlaceholder;
