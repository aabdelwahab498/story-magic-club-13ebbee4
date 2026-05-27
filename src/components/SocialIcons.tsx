import { Facebook, Instagram, Youtube } from "lucide-react";
import { SocialPlatform } from "@/hooks/useSocialLinks";

/**
 * Brand-accurate inline SVGs for platforms not in lucide-react.
 * currentColor is used so they inherit the parent text color (theme-friendly).
 */
const SnapchatIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.166 2c3.515 0 5.265 2.667 5.265 5.97 0 .507-.025 1.018-.07 1.51.32.16.696.249 1.084.249.345 0 .806-.111 1.124-.234.097-.038.196-.058.293-.058.16 0 .315.04.45.108.27.135.43.395.43.71 0 .26-.123.51-.385.732-.262.222-.665.42-1.262.59-.124.034-.21.103-.235.184-.044.146.066.34.187.51.262.366.62.766 1.07 1.04.46.276 1.06.466 1.78.477.34.005.587.31.51.65-.066.286-.31.487-.6.555-.7.166-1.69.27-2.05.39-.21.07-.31.21-.36.4-.05.193-.04.43-.13.66-.09.235-.27.42-.6.42-.33 0-.74-.13-1.27-.13-.73 0-1.13.16-1.83.61-.71.46-1.51 1.07-2.81 1.07-1.3 0-2.1-.61-2.81-1.07-.7-.45-1.1-.61-1.83-.61-.53 0-.94.13-1.27.13-.33 0-.51-.185-.6-.42-.09-.23-.08-.467-.13-.66-.05-.19-.15-.33-.36-.4-.36-.12-1.35-.224-2.05-.39-.29-.068-.534-.27-.6-.555-.077-.34.17-.645.51-.65.72-.011 1.32-.2 1.78-.477.45-.274.808-.674 1.07-1.04.121-.17.231-.364.187-.51-.025-.08-.111-.15-.235-.184-.597-.17-1-.368-1.262-.59-.262-.222-.385-.472-.385-.732 0-.315.16-.575.43-.71.135-.068.29-.108.45-.108.097 0 .196.02.293.058.318.123.78.234 1.124.234.388 0 .764-.09 1.084-.249-.045-.492-.07-1.003-.07-1.51C6.901 4.667 8.651 2 12.166 2z" />
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.09z" />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.601.954-1.001 3.654 3.755-.985.624.418zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12 12-5.373 12-12S18.626 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.643.135-.953l11.566-4.458c.538-.196 1.006.128.832.953z" />
  </svg>
);

interface PlatformConfig {
  Icon: (p: { className?: string }) => JSX.Element;
  label: string;
  hoverClass: string;
  /** Default site URL (used when admin has not configured a specific link). */
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
  snapchat: {
    Icon: SnapchatIcon,
    label: "Snapchat",
    hoverClass: "hover:bg-[#FFFC00] hover:text-black hover:border-[#FFFC00]",
    defaultUrl: "https://snapchat.com",
    href: (v) => v || "https://snapchat.com",
  },
  tiktok: {
    Icon: TikTokIcon,
    label: "TikTok",
    hoverClass: "hover:bg-black hover:text-white hover:border-black",
    defaultUrl: "https://tiktok.com",
    href: (v) => v || "https://tiktok.com",
  },
  telegram: {
    Icon: TelegramIcon,
    label: "Telegram",
    hoverClass: "hover:bg-[#0088CC] hover:text-white hover:border-[#0088CC]",
    defaultUrl: "https://telegram.org",
    href: (v) => v || "https://telegram.org",
  },
  whatsapp: {
    Icon: WhatsAppIcon,
    label: "WhatsApp",
    hoverClass: "hover:bg-[#25D366] hover:text-white hover:border-[#25D366]",
    defaultUrl: "https://whatsapp.com",
    href: (v) => {
      // Allow phone numbers OR full wa.me URLs
      if (!v) return "https://whatsapp.com";
      if (/^https?:\/\//i.test(v)) return v;
      const digits = v.replace(/[^\d]/g, "");
      return digits ? `https://wa.me/${digits}` : "https://whatsapp.com";
    },
  },
};
