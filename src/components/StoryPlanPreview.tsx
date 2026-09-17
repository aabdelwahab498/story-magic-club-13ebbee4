import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizePlanBlueprint } from "@/lib/selStoryApi";

interface StoryPlanPreviewProps {
  /**
   * Plan blueprint from `POST /api/v2/stories/plan`. Accepts the canonical
   * V6R3 shape (`{ title, characters[], conflict, resolution, selGoals[] }`)
   * as well as the legacy `{ hero, acts, selOutcome }` shape — the payload is
   * re-normalized here so a missing/renamed field can never crash the page.
   */
  plan: unknown;
  onEdit: () => void;
  onApprove: () => void;
}

/**
 * Blueprint preview modal — the user approves the plan before the full write.
 * Rendering is fully defensive: every field is resolved to a string/array up
 * front, so no property is dereferenced on a possibly-undefined object.
 */
export function StoryPlanPreview({ plan, onEdit, onApprove }: StoryPlanPreviewProps) {
  const { t } = useTranslation();
  const blueprint = normalizePlanBlueprint(plan);

  const title = blueprint.title || "";
  const heroName = blueprint.hero?.name || "";
  const heroCharm = blueprint.hero?.charm || "";
  const companionName = blueprint.companion?.name || "";
  const companionRole = blueprint.companion?.role || "";
  const acts = blueprint.acts ?? {
    act1_normalWorld: "",
    act2_disturbance: "",
    act3_attempts: [],
    act4_resolution: "",
  };
  const attempts = Array.isArray(acts.act3_attempts) ? acts.act3_attempts : [];
  const outcome = blueprint.selOutcome?.statement || "";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 sm:p-6 max-w-2xl w-full my-8 text-left rtl:text-right">
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
          {t("page_ai_storyteller.story_preview", "Story preview")}
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          {t("page_ai_storyteller.review_the_plan_before_the_full_story_is", "Review the plan before the full story is written. If it doesn't match, go back and edit your brief.")}
        </p>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2 rtl:pl-2 rtl:pr-0">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">
              {t("page_ai_storyteller.title", "Title")}
            </p>
            <p className="text-base font-bold text-foreground">{title}</p>
          </div>
          {heroName && (
            <div>
              <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">
                {t("page_ai_storyteller.hero", "Hero")}
              </p>
              <p className="text-sm text-foreground/90">
                <strong>{heroName}</strong>
                {heroCharm ? ` — ${heroCharm}` : ""}
              </p>
            </div>
          )}
          {companionName && (
            <div>
              <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">
                {t("page_ai_storyteller.companion", "Companion")}
              </p>
              <p className="text-sm text-foreground/90">
                <strong>{companionName}</strong>
                {companionRole ? ` — ${companionRole}` : ""}
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-1">
              {t("page_ai_storyteller.acts", "Acts")}
            </p>
            <ol className="space-y-1.5 text-sm text-foreground/90 list-decimal pl-5 rtl:pr-5 rtl:pl-0">
              <li>{acts.act1_normalWorld || ""}</li>
              <li>{acts.act2_disturbance || ""}</li>
              <li>{attempts.join(" → ")}</li>
              <li>{acts.act4_resolution || ""}</li>
            </ol>
          </div>
          {outcome && (
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[11px] uppercase tracking-wide font-bold text-primary mb-1">
                {t("page_ai_storyteller.emotional_outcome", "Emotional outcome")}
              </p>
              <p className="text-xs sm:text-sm text-foreground/90">{outcome}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 justify-end rtl:justify-start">
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2 rounded-full bg-muted text-foreground font-bold text-sm hover:bg-muted/80 transition"
          >
            {t("page_ai_storyteller.edit_brief", "Edit brief")}
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition inline-flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            {t("page_ai_storyteller.write_the_story", "Write the story")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoryPlanPreview;
