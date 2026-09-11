// Phase 2 — Compact child-profile picker shown in headers.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, User as UserIcon, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveChild, setActiveChildId } from "@/lib/childProfilesApi";
import { useAuth } from "@/hooks/useAuth";

const ChildPicker = () => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { active, children } = useActiveChild();

  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/80 dark:bg-white/15 border border-foreground/10 dark:border-white/25 text-xs font-bold hover:bg-white dark:hover:bg-white/25 transition-colors"
          aria-label="Active child"
        >
          <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <UserIcon className="h-3 w-3 text-primary" />
          </span>
          <span className="max-w-[80px] truncate">
            {active?.name ?? t("family.no_child", "No child")}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("family.active_child", "Active child")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children.length === 0 ? (
          <DropdownMenuItem disabled>
            {t("family.empty_short", "No children yet")}
          </DropdownMenuItem>
        ) : (
          children.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => setActiveChildId(c.id)}
              className={c.id === active?.id ? "font-bold" : ""}
            >
              <UserIcon className="h-4 w-4 mr-2 opacity-70" />
              {c.name}
              {c.age ? <span className="ml-1 text-xs opacity-60">({c.age})</span> : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/parent" className="cursor-pointer">
            <UserIcon className="h-4 w-4 mr-2" />
            {t("family.parent_dashboard", "Parent dashboard")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/family" className="cursor-pointer">
            <UserPlus className="h-4 w-4 mr-2" />
            {t("family.manage", "Manage family")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChildPicker;
