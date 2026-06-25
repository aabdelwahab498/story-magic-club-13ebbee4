import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Gift, RotateCw, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useStreak } from "@/hooks/useStreak";

interface SpinWheelModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STORAGE_KEY = "najmah:lastSpinAt";
const REWARD_KEY = "najmah:lastReward";
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

const SLICES = [
  { key: "discount_10", color: "hsl(var(--primary))" },
  { key: "try_again", color: "hsl(45 95% 60%)" },
  { key: "try_again", color: "hsl(var(--muted))" },
  { key: "free_blog_article", color: "hsl(280 70% 65%)" },
  { key: "discount_10", color: "hsl(var(--primary) / 0.7)" },
  { key: "custom_story", color: "hsl(195 80% 60%)" },
  { key: "try_again", color: "hsl(var(--muted-foreground) / 0.4)" },
  { key: "try_again", color: "hsl(15 90% 65%)" },
] as const;

const SLICE_ANGLE = 360 / SLICES.length;

const SpinWheelModal = ({ open, onOpenChange }: SpinWheelModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { freeSpins, consumeFreeSpin } = useStreak();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const tickRef = useRef<number>();

  // Cooldown countdown
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      const left = Math.max(0, COOLDOWN_MS - (Date.now() - last));
      setCooldownLeft(left);
    };
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [open]);

  // Free streak-spin token bypasses the cooldown
  const hasFreeSpin = freeSpins > 0;
  const canSpin = (cooldownLeft <= 0 || hasFreeSpin) && !spinning;

  const cooldownLabel = useMemo(() => {
    if (cooldownLeft <= 0) return null;
    const h = Math.floor(cooldownLeft / 3_600_000);
    const m = Math.floor((cooldownLeft % 3_600_000) / 60_000);
    const s = Math.floor((cooldownLeft % 60_000) / 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [cooldownLeft]);

  const handleSpin = () => {
    if (!canSpin) return;

    // Decide whether this spin uses a free streak token (bypasses cooldown)
    // or starts a fresh 24h cooldown.
    const usingFreeSpin = cooldownLeft > 0 && hasFreeSpin;
    if (usingFreeSpin) {
      const ok = consumeFreeSpin();
      if (!ok) return; // race-safety: token vanished
    }

    setResult(null);
    setSpinning(true);

    // pick a random slice
    const winningIndex = Math.floor(Math.random() * SLICES.length);
    const spins = 6;
    const targetCenter = winningIndex * SLICE_ANGLE + SLICE_ANGLE / 2;
    const jitter = (Math.random() - 0.5) * (SLICE_ANGLE * 0.5);
    const finalAngle = 360 * spins - targetCenter + jitter;

    setAngle((prev) => {
      const base = Math.floor(prev / 360) * 360;
      return base + finalAngle;
    });

    window.setTimeout(() => {
      const winKey = SLICES[winningIndex].key;
      setResult(winKey);
      setSpinning(false);
      // Only the daily spin sets the cooldown — free streak spins don't.
      if (!usingFreeSpin) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
      localStorage.setItem(REWARD_KEY, winKey);
      if (winKey !== "try_again") {
        toast({
          title: t("wheel.win_toast_title"),
          description: t(`wheel.rewards.${winKey}`),
        });
      }
    }, 4200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-3xl border-2 border-white/60 bg-gradient-to-br from-kids-softPurple via-white to-kids-softYellow/40 dark:from-card dark:via-card dark:to-card">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold text-center flex items-center justify-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            {t("wheel.title")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("wheel.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto" style={{ width: 280, height: 280 }}>
          {/* Pointer */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-2 z-20"
            aria-hidden="true"
          >
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-sunset drop-shadow-md" />
          </div>

          {/* Wheel */}
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full drop-shadow-xl"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: spinning
                ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 1)"
                : "none",
            }}
          >
            {SLICES.map((slice, i) => {
              const startAngle = i * SLICE_ANGLE - 90; // start at top
              const endAngle = startAngle + SLICE_ANGLE;
              const r = 100;
              const cx = 100;
              const cy = 100;
              const toRad = (a: number) => (a * Math.PI) / 180;
              const x1 = cx + r * Math.cos(toRad(startAngle));
              const y1 = cy + r * Math.sin(toRad(startAngle));
              const x2 = cx + r * Math.cos(toRad(endAngle));
              const y2 = cy + r * Math.sin(toRad(endAngle));
              const largeArc = SLICE_ANGLE > 180 ? 1 : 0;
              const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

              const labelAngle = startAngle + SLICE_ANGLE / 2;
              const labelR = 65;
              const lx = cx + labelR * Math.cos(toRad(labelAngle));
              const ly = cy + labelR * Math.sin(toRad(labelAngle));

              return (
                <g key={i}>
                  <path d={path} fill={slice.color} stroke="white" strokeWidth="2" />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="white"
                    transform={`rotate(${labelAngle + 90} ${lx} ${ly})`}
                  >
                    {t(`wheel.short.${slice.key}`)}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="14" fill="white" stroke="hsl(var(--primary))" strokeWidth="3" />
          </svg>
        </div>

        {result && !spinning ? (
          <div className="text-center bg-white/90 dark:bg-card/80 rounded-2xl p-4 border-2 border-sunset shadow-soft space-y-3">
            <Sparkles className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="font-bold text-lg text-foreground">
              {result === "try_again" ? t("wheel.try_again_title") : t("wheel.you_won")}
            </p>
            <p className="text-primary font-bold text-xl">
              {t(`wheel.rewards.${result}`)}
            </p>
            {result !== "try_again" && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate("/pricing");
                }}
                className="w-full px-6 py-3 bg-sunset text-white rounded-full font-bold text-base hover-pop shadow-soft inline-flex items-center justify-center gap-2"
              >
                {t("wheel.subscribe_to_claim", "Subscribe now to claim")}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}

        {hasFreeSpin && cooldownLeft > 0 && !spinning && (
          <p className="text-center text-xs text-primary font-semibold -mb-1">
            🔥 {t("wheel.free_spin_available", { count: freeSpins })}
          </p>
        )}

        <button
          onClick={handleSpin}
          disabled={!canSpin}
          className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold text-lg hover-pop shadow-soft disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          <RotateCw className={spinning ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
          {spinning
            ? t("wheel.spinning")
            : hasFreeSpin && cooldownLeft > 0
              ? t("wheel.use_free_spin")
              : cooldownLabel
                ? t("wheel.come_back_in", { time: cooldownLabel })
                : t("wheel.spin_now")}
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default SpinWheelModal;
