import { Outlet, useLocation } from "react-router-dom";
import Navigation from "./Navigation";
import LanguageSuggestionBanner from "./LanguageSuggestionBanner";
import PageBackground from "./PageBackground";
import Footer from "./Footer";
import SocialMediaIcons from "./SocialMediaIcons";
import AiAssistantButton from "./AiAssistantButton";
import BottomNav from "./BottomNav";
import AdPlaceholder from "./AdPlaceholder";
import OfflineBanner from "./OfflineBanner";
import { useTheme } from "@/hooks/useTheme";

const Layout = () => {
  const { theme } = useTheme();
  const { pathname } = useLocation();

  // Home & themed pages let the PageBackground image show fully — no gradient overlay
  const isHome = pathname === "/";
  const isStories = pathname.startsWith("/stories");
  const isAI = pathname.startsWith("/ai-storyteller");
  const isDrawing = pathname.startsWith("/drawing-competition");
  const hasImageBg = isHome || isStories || isAI || isDrawing;

  const bgClass =
    theme === "dark"
      ? "bg-gradient-to-br from-[hsl(240,60%,6%)] via-[hsl(260,55%,10%)] to-[hsl(220,60%,8%)]"
      : hasImageBg
        ? "bg-transparent"
        : "bg-gradient-to-br from-kids-softPurple via-kids-softBlue to-kids-softYellow/40";

  return (
    <div
      className={`min-h-screen font-comic relative transition-colors duration-500 flex flex-col overflow-x-clip ${bgClass}`}
    >
      <PageBackground />
      <OfflineBanner />

      <LanguageSuggestionBanner />
      <Navigation />
      {/* Social icons in the top-right corner — desktop only. Tablet/mobile users find them in the footer. */}
      <div className="container mx-auto px-4 sm:px-6 mt-2 relative z-10 hidden lg:flex justify-end">
        <SocialMediaIcons
          orientation="horizontal"
          size="sm"
          showPlaceholders
          className="!flex !flex-col !items-end !gap-1.5 bg-transparent"
        />
      </div>
      <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 animate-fade-in relative z-10 flex-1 w-full pb-24 lg:pb-8">
        <Outlet />
      </main>
      <AdPlaceholder />
      <Footer />
      <AiAssistantButton />
      <BottomNav />
    </div>
  );
};

export default Layout;
