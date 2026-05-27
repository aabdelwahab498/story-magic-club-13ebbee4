import { CreditCard, Building2, QrCode, Receipt, Smartphone, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Region = "egypt" | "international";
export type Currency = "EGP" | "USD" | "EUR";

export interface PaymentMethod {
  id: string;
  /** Regions where this method is shown. */
  regions: Region[];
  /** Currencies the method supports. If more than one, the user must pick. */
  currencies: Currency[];
  name: string;
  desc: string;
  icon: LucideIcon;
  gradient: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  // Egypt-only (EGP only)
  {
    id: "instapay",
    regions: ["egypt"],
    currencies: ["EGP"],
    name: "InstaPay",
    desc: "Scan QR to pay instantly",
    icon: QrCode,
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    id: "vodafone_cash",
    regions: ["egypt"],
    currencies: ["EGP"],
    name: "Vodafone Cash",
    desc: "Pay from your Vodafone Cash wallet",
    icon: Wallet,
    gradient: "from-red-500 to-rose-600",
  },
  // Egypt + International (multi-currency)
  {
    id: "fawry",
    regions: ["egypt", "international"],
    currencies: ["EGP", "USD", "EUR"],
    name: "Fawry",
    desc: "Pay with reference code at any Fawry outlet",
    icon: Receipt,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    id: "paymob",
    regions: ["egypt", "international"],
    currencies: ["EGP", "USD", "EUR"],
    name: "Paymob",
    desc: "Local cards & wallets",
    icon: Smartphone,
    gradient: "from-violet-400 to-purple-500",
  },
  // International
  {
    id: "card",
    regions: ["international"],
    currencies: ["USD", "EUR"],
    name: "Credit / Debit Card",
    desc: "Visa, Mastercard, Amex",
    icon: CreditCard,
    gradient: "from-sky-400 to-indigo-500",
  },
  {
    id: "bank",
    regions: ["international"],
    currencies: ["USD", "EUR"],
    name: "Bank Transfer (Wire / SEPA)",
    desc: "International wire transfer or SEPA",
    icon: Building2,
    gradient: "from-slate-400 to-slate-600",
  },
];

export const getMethod = (id: string | null) =>
  PAYMENT_METHODS.find((m) => m.id === id) ?? null;

export const getMethodsForRegion = (region: Region) =>
  PAYMENT_METHODS.filter((m) => m.regions.includes(region));

export const getDefaultMethodForRegion = (region: Region) =>
  region === "egypt" ? "instapay" : "card";

/** Approx FX rates from USD — UI-only, not for accounting. */
const USD_TO: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  EGP: 48,
};

/** Convert a price expressed in `from` currency to `to` currency. */
export const convertPrice = (amount: number, from: Currency, to: Currency): number => {
  if (from === to) return amount;
  const inUsd = amount / USD_TO[from];
  const out = inUsd * USD_TO[to];
  // Round nicely: integer for EGP, 2 decimals otherwise
  return to === "EGP" ? Math.round(out) : Math.round(out * 100) / 100;
};

export const formatPrice = (amount: number, currency: Currency): string => {
  switch (currency) {
    case "EGP":
      return `${amount.toLocaleString()} EGP`;
    case "EUR":
      return `€${amount}`;
    case "USD":
    default:
      return `$${amount}`;
  }
};

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  region: Region;
  currency: Currency;
}

export const COUNTRIES: CountryOption[] = [
  { code: "EG", name: "Egypt", flag: "🇪🇬", region: "egypt", currency: "EGP" },
  { code: "US", name: "United States", flag: "🇺🇸", region: "international", currency: "USD" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", region: "international", currency: "USD" },
  { code: "DE", name: "Germany", flag: "🇩🇪", region: "international", currency: "EUR" },
  { code: "FR", name: "France", flag: "🇫🇷", region: "international", currency: "EUR" },
  { code: "ES", name: "Spain", flag: "🇪🇸", region: "international", currency: "EUR" },
  { code: "IT", name: "Italy", flag: "🇮🇹", region: "international", currency: "EUR" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", region: "international", currency: "USD" },
  { code: "AE", name: "UAE", flag: "🇦🇪", region: "international", currency: "USD" },
  { code: "OTHER", name: "Other", flag: "🌍", region: "international", currency: "USD" },
];

const LAST_METHOD_KEY = "najmah:lastPaymentMethod";
const LAST_COUNTRY_KEY = "najmah:lastCountry";
const LAST_CURRENCY_KEY = "najmah:lastCurrency";

export const saveLastMethod = (id: string) => {
  try { localStorage.setItem(LAST_METHOD_KEY, id); } catch { /* ignore */ }
};
export const getLastMethod = (): string | null => {
  try { return localStorage.getItem(LAST_METHOD_KEY); } catch { return null; }
};
export const saveLastCountry = (code: string) => {
  try { localStorage.setItem(LAST_COUNTRY_KEY, code); } catch { /* ignore */ }
};
export const getLastCountry = (): string | null => {
  try { return localStorage.getItem(LAST_COUNTRY_KEY); } catch { return null; }
};
export const saveLastCurrency = (c: Currency) => {
  try { localStorage.setItem(LAST_CURRENCY_KEY, c); } catch { /* ignore */ }
};
export const getLastCurrency = (): Currency | null => {
  try {
    const v = localStorage.getItem(LAST_CURRENCY_KEY);
    return v === "EGP" || v === "USD" || v === "EUR" ? v : null;
  } catch { return null; }
};

export const detectCountry = (): string => {
  const saved = getLastCountry();
  if (saved) return saved;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Cairo") || tz.includes("Africa/Cairo")) return "EG";
    const lang = navigator.language || "";
    if (lang.toLowerCase().startsWith("ar")) return "EG";
  } catch { /* ignore */ }
  return "US";
};
