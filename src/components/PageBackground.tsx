import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import bgHomeMagical from "@/assets/bg-home-magical.jpg";
import bgStoriesForest from "@/assets/bg-stories-forest.jpg";


/**
 * PageBackground — kid-friendly themed background that changes per page.
 * Light, gentle animations only. All colors via design tokens.
 */
const PageBackground = () => {
  const { pathname } = useLocation();
  const { theme } = useTheme();

  // Dark mode keeps the magical starry sky everywhere — bedtime mood.
  if (theme === "dark") {
    return (
      <>
        <div className="starry-sky fixed inset-0 -z-10" />
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float" />
          <div className="absolute top-1/2 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl animate-float-slow" />
          <div
            className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-primary-glow/15 blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
        </div>
      </>
    );
  }

  // Light mode → per-page themes
  const isStories = pathname.startsWith("/stories");
  const isAI = pathname.startsWith("/ai-storyteller");
  const isDrawing = pathname.startsWith("/drawing-competition");

  if (isStories) {
    // 🌳 Magical enchanted forest with subtle motion
    return (
      <div key="bg-forest" className="pointer-events-none fixed inset-0 -z-10 animate-fade-in overflow-hidden">
        <img
          src={bgStoriesForest}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-[110%] w-[110%] -top-[5%] -left-[5%] object-cover animate-bg-pan"
        />
        {/* Soft readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/40" />
        {/* Floating fireflies */}
        <span className="firefly" style={{ left: "10%", top: "20%", animationDelay: "0s" }} />
        <span className="firefly" style={{ left: "30%", top: "60%", animationDelay: "1.2s" }} />
        <span className="firefly" style={{ left: "55%", top: "35%", animationDelay: "2.5s" }} />
        <span className="firefly" style={{ left: "75%", top: "70%", animationDelay: "0.8s" }} />
        <span className="firefly" style={{ left: "85%", top: "25%", animationDelay: "3s" }} />
        <span className="firefly" style={{ left: "45%", top: "80%", animationDelay: "1.8s" }} />
      </div>
    );
  }

  if (isAI) {
    // 🤍 Plain white background for maximum readability
    return (
      <div
        key="bg-white"
        className="pointer-events-none fixed inset-0 -z-10 bg-white animate-fade-in"
      />
    );
  }

  if (isDrawing) {
    // 🎨 Color world
    return (
      <div
        key="bg-art"
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-[hsl(330,90%,95%)] via-[hsl(50,95%,92%)] to-[hsl(180,80%,92%)] animate-fade-in"
      >
        <div className="absolute inset-0 bg-bg-dots opacity-40" />
        {/* Paint splashes */}
        <div className="absolute top-8 left-8 h-64 w-64 rounded-full bg-kids-pink/40 blur-3xl animate-float" />
        <div className="absolute top-1/2 right-12 h-72 w-72 rounded-full bg-kids-yellow/40 blur-3xl animate-float-slow" />
        <div
          className="absolute bottom-8 left-1/3 h-64 w-64 rounded-full bg-kids-green/40 blur-3xl animate-float"
          style={{ animationDelay: "1.8s" }}
        />
      </div>
    );
  }

  // 🌙 Default (Home / Auth / Admin) → magical purple dreamscape
  return (
    <div key="bg-home" className="pointer-events-none fixed inset-0 -z-10 animate-fade-in overflow-hidden">
      {/* Hero illustrated background — fully visible + animated */}
      <img
        src={bgHomeMagical}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-[115%] w-[115%] -top-[7%] -left-[7%] object-cover animate-bg-magical"
      />

      {/* ✨ Shimmer sweep — magical light passing across */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -inset-y-10 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-2xl animate-shimmer-sweep"
        />
      </div>

      {/* Twinkling sparkles only — no color bubbles to keep image crisp */}
      <span className="firefly" style={{ left: "15%", top: "30%", animationDelay: "0.5s" }} />
      <span className="firefly" style={{ left: "70%", top: "45%", animationDelay: "2s" }} />
      <span className="firefly" style={{ left: "40%", top: "75%", animationDelay: "3.5s" }} />
      <span className="firefly" style={{ left: "85%", top: "20%", animationDelay: "1.2s" }} />
      <span className="firefly" style={{ left: "25%", top: "55%", animationDelay: "2.8s" }} />
      <span className="firefly" style={{ left: "55%", top: "15%", animationDelay: "4s" }} />
      <span className="firefly" style={{ left: "10%", top: "85%", animationDelay: "1.8s" }} />
    </div>
  );
};

export default PageBackground;
