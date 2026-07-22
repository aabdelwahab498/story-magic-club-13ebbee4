/* eslint-disable react-refresh/only-export-components */
// File contains inline helper icon components and exports multiple platform components.
import { Facebook, Instagram, Youtube } from "lucide-react";
import { SocialPlatform } from "@/hooks/useSocialLinks";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.09z" />
  </svg>
);

const PinterestIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.747 2.853c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z" />
  </svg>
);

const RedditIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.67 13.67c.03.21.05.43.05.65 0 3.31-3.85 6-8.59 6s-8.59-2.69-8.59-6c0-.23.02-.45.05-.66-.74-.33-1.26-1.07-1.26-1.93 0-1.17.95-2.12 2.12-2.12.57 0 1.08.22 1.46.59 1.45-.97 3.39-1.59 5.55-1.67l1.16-5.46c.03-.13.16-.22.29-.19l3.84.81c.27-.55.83-.92 1.49-.92.92 0 1.66.75 1.66 1.66 0 .92-.74 1.66-1.66 1.66s-1.66-.74-1.66-1.66v-.04l-3.43-.72-1.04 4.9c2.13.1 4.04.72 5.47 1.68.38-.37.89-.59 1.46-.59 1.17 0 2.12.95 2.12 2.12 0 .87-.52 1.61-1.27 1.94zM8.46 14.51c0-.84-.68-1.52-1.52-1.52s-1.52.68-1.52 1.52.68 1.52 1.52 1.52 1.52-.68 1.52-1.52zm6.6 0c0-.84-.68-1.52-1.52-1.52s-1.52.68-1.52 1.52.68 1.52 1.52 1.52 1.52-.68 1.52-1.52zm-.45 2.83c-.13-.13-.34-.13-.47 0-.55.55-1.61.6-1.92.6-.31 0-1.37-.05-1.92-.6-.13-.13-.34-.13-.47 0-.13.13-.13.34 0 .47.87.87 2.54.94 2.39.94.15 0 1.52-.07 2.39-.94.13-.13.13-.34 0-.47z" />
  </svg>
);

const QuoraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.738 18.701c-.831-1.635-1.805-3.27-3.732-3.27-.368 0-.736.06-1.07.21l-.652-1.302c.795-.681 2.08-1.221 3.732-1.221 2.573 0 3.9 1.232 4.961 2.815.625-1.301.929-3.058.929-5.214 0-5.387-1.685-8.143-5.07-8.143-3.341 0-5.028 2.756-5.028 8.143 0 5.358 1.687 8.099 5.028 8.099.32 0 .619-.014.902-.117zm1.187 2.336c-.658.157-1.36.246-2.089.246C6.503 21.283 1.5 17.36 1.5 11.719 1.5 6.025 6.503 2.143 11.836 2.143c5.43 0 10.392 3.86 10.392 9.576 0 3.182-1.547 5.792-3.852 7.413.74 1.122 1.5 1.869 2.563 1.869 1.157 0 1.625-.892 1.703-1.59h1.359c.078.93-.39 4.446-4.626 4.446-2.573 0-3.929-1.498-5.005-3.42z" />
  </svg>
);

const AmazonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726a17.617 17.617 0 01-10.951-.577 17.88 17.88 0 01-5.43-3.35c-.1-.074-.151-.15-.151-.22 0-.047.021-.09.051-.13zm6.565-6.218c0-1.005.247-1.863.743-2.577.495-.71 1.17-1.25 2.04-1.615.796-.335 1.756-.575 2.912-.72.39-.046 1.033-.103 1.92-.174v-.37c0-.93-.105-1.558-.3-1.875-.302-.43-.78-.65-1.44-.65h-.182c-.48.046-.896.196-1.247.46-.36.27-.59.63-.69 1.11-.06.3-.21.47-.45.51l-2.58-.32c-.247-.06-.37-.18-.37-.39 0-.027.012-.09.03-.18.27-1.395.93-2.43 1.965-3.09S11.5 1.5 13.06 1.5h.43c2.79 0 4.5 1.31 5.13 3.94.105.39.18.85.21 1.37l.045 1.65v3.96c0 .9.135 1.71.4 2.46.18.51.42 1.05.715 1.62.105.165.165.32.165.435 0 .12-.06.225-.195.345-1.395 1.215-2.16 1.875-2.28 1.95-.21.135-.435.18-.66.08-.27-.225-.51-.45-.72-.66l-.42-.435a8.99 8.99 0 01-.4-.555l-.275-.405c-.78.855-1.545 1.395-2.295 1.605-.475.135-1.06.2-1.755.2-1.07 0-1.95-.33-2.64-.99-.69-.66-1.035-1.6-1.035-2.82zm3.46-.4c0 .54.135.975.405 1.305.27.33.63.495 1.08.495.04 0 .105-.005.18-.015s.135-.015.165-.015c.57-.15 1.02-.51 1.32-1.08.15-.255.255-.525.33-.825.075-.295.105-.55.12-.74l.015-.39v-.66c-.84 0-1.485.06-1.92.18-1.275.36-1.917 1.18-1.917 2.45zm9.41 7.81c.103-.156.252-.213.45-.17.045.014.13.038.244.07.345.103.65.225.92.367.06.038.107.085.14.137.033.052.043.107.027.16-.014.197-.073.397-.175.6-.103.198-.243.397-.42.595-.176.198-.36.378-.543.54-.18.16-.33.276-.43.345-.044.03-.083.045-.118.045-.014 0-.024-.005-.03-.014-.015-.027-.022-.066-.014-.117.06-.36.135-.66.225-.9.075-.198.16-.39.25-.572.09-.18.16-.32.21-.42.045-.105.06-.165.06-.18-.014-.014-.06-.014-.143 0-.36.066-.73.144-1.117.235-.073.014-.13.014-.176 0-.045-.013-.073-.046-.087-.097-.014-.045 0-.09.044-.135.117-.105.27-.21.45-.314z" />
  </svg>
);

interface PlatformConfig {
  Icon: (p: { className?: string }) => JSX.Element;
  label: string;
  hoverClass: string;
  defaultUrl: string;
  href: (raw: string) => string;
}

export const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  facebook: {
    Icon: ({ className }) => <Facebook className={className} />,
    label: "Facebook",
    hoverClass: "hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]",
    defaultUrl: "https://facebook.com",
    href: (v) => v || "https://facebook.com",
  },
  instagram: {
    Icon: ({ className }) => <Instagram className={className} />,
    label: "Instagram",
    hoverClass:
      "hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] hover:text-white hover:border-transparent",
    defaultUrl: "https://instagram.com",
    href: (v) => v || "https://instagram.com",
  },
  youtube: {
    Icon: ({ className }) => <Youtube className={className} />,
    label: "YouTube",
    hoverClass: "hover:bg-[#FF0000] hover:text-white hover:border-[#FF0000]",
    defaultUrl: "https://youtube.com",
    href: (v) => v || "https://youtube.com",
  },
  tiktok: {
    Icon: TikTokIcon,
    label: "TikTok",
    hoverClass: "hover:bg-black hover:text-white hover:border-black",
    defaultUrl: "https://tiktok.com",
    href: (v) => v || "https://tiktok.com",
  },
  pinterest: {
    Icon: PinterestIcon,
    label: "Pinterest",
    hoverClass: "hover:bg-[#E60023] hover:text-white hover:border-[#E60023]",
    defaultUrl: "https://pinterest.com",
    href: (v) => v || "https://pinterest.com",
  },
  reddit: {
    Icon: RedditIcon,
    label: "Reddit",
    hoverClass: "hover:bg-[#FF4500] hover:text-white hover:border-[#FF4500]",
    defaultUrl: "https://reddit.com",
    href: (v) => v || "https://reddit.com",
  },
  quora: {
    Icon: QuoraIcon,
    label: "Quora",
    hoverClass: "hover:bg-[#B92B27] hover:text-white hover:border-[#B92B27]",
    defaultUrl: "https://quora.com",
    href: (v) => v || "https://quora.com",
  },
  amazon: {
    Icon: ({ className }) => <AmazonIcon className={className} />,
    label: "Amazon",
    hoverClass: "hover:bg-[#FF9900] hover:text-black hover:border-[#FF9900]",
    defaultUrl: "https://amazon.com",
    href: (v) => v || "https://amazon.com",
  },
};
