import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface CountdownTimerProps {
  deadline: Date;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function calc(deadline: Date): TimeLeft {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: false,
  };
}

const CountdownTimer = ({ deadline }: CountdownTimerProps) => {
  const { t } = useTranslation();
  const [time, setTime] = useState<TimeLeft>(() => calc(deadline));

  useEffect(() => {
    const id = setInterval(() => setTime(calc(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const items = [
    { label: t("competition.countdown.days"), value: time.days },
    { label: t("competition.countdown.hours"), value: time.hours },
    { label: t("competition.countdown.minutes"), value: time.minutes },
    { label: t("competition.countdown.seconds"), value: time.seconds },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-card/90 backdrop-blur rounded-2xl shadow-soft px-3 py-2 sm:px-4 sm:py-3 min-w-[64px] sm:min-w-[72px] text-center border-2 border-white/60"
        >
          <div className="text-2xl sm:text-3xl font-bold text-primary tabular-nums leading-none">
            {String(it.value).padStart(2, "0")}
          </div>
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mt-1">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CountdownTimer;
