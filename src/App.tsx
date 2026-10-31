import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import finGuardLogo from "./assets/FinGuard Logo.png";
import { getCurrentUser, loginUser, logoutUser, signupUser, type AuthUser } from "./auth";
import {
  Activity,
  Bell,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  UserRound,
  Moon,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Wallet,
  X,
} from "lucide-react";

type Risk = "High" | "Medium" | "Low";

type Transaction = {
  id: string;
  name: string;
  merchant: string;
  location: string;
  initials: string;
  type: string;
  amount: number;
  time: string;
  timestamp: number;
  risk: Risk;
  riskScore: number;
  isFraud: boolean;
  reason: string;
};

type ApiTransaction = {
  id?: string;
  transaction_id?: string;
  name?: string;
  user_id?: string;
  merchant?: string;
  amount?: number | string;
  type?: string;
  transaction_type?: string;
  hour?: number;
  transaction_time?: string;
  time?: string;
  location?: string;
  risk_score?: number | string;
  riskScore?: number | string;
  risk?: string;
  risk_level?: string;
  riskLevel?: string;
  is_fraud?: boolean;
  reasons?: string[];
  reason?: string;
  recent_count?: number;
};

type Summary = {
  total: number;
  high: number;
  medium: number;
  low: number;
  fraud_count: number;
  total_amount: number;
  average_risk_score: number;
};

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Transactions", icon: CreditCard },
  { label: "Risk Analysis", icon: Activity },
  { label: "Investigations", icon: ShieldAlert },
];

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const compactMoney = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);

const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function normalizeTransaction(item: ApiTransaction, index: number): Transaction {
  const id = String(item.id ?? item.transaction_id ?? `TXN-${index + 1}`);
  const merchant = String(item.merchant ?? item.name ?? "Unknown merchant");
  const name = String(item.name ?? item.user_id ?? merchant);
  const timestampValue = item.transaction_time ?? item.time;
  const parsedTime = timestampValue ? new Date(timestampValue) : null;
  const timestamp =
    parsedTime && !Number.isNaN(parsedTime.getTime())
      ? parsedTime.getTime()
      : 0;

  const score = Math.max(
    0,
    Math.min(100, number(item.risk_score ?? item.riskScore, 0)),
  );

  const rawRisk = String(
    item.risk ?? item.risk_level ?? item.riskLevel ?? "",
  ).toLowerCase();

  const risk: Risk =
    rawRisk === "high" || rawRisk === "medium" || rawRisk === "low"
      ? (rawRisk[0].toUpperCase() + rawRisk.slice(1)) as Risk
      : score >= 70
        ? "High"
        : score >= 35
          ? "Medium"
          : "Low";

  const reasons =
  Array.isArray(item.reasons) && item.reasons.length > 0
    ? item.reasons.join(". ")
    : item.reason?.trim() ||
      "No risk explanation is currently available from the API.";

  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hour = number(item.hour, -1);
  const time =
    parsedTime && !Number.isNaN(parsedTime.getTime())
      ? parsedTime.toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : hour >= 0
        ? `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`
        : "Time unavailable";

  return {
    id,
    name,
    merchant,
    location: item.location ?? "Location unavailable",
    initials: initials || "TX",
    type: String(item.type ?? item.transaction_type ?? "Unknown"),
    amount: number(item.amount),
    time,
    timestamp,
    risk,
    riskScore: score,
    isFraud: item.is_fraud === true,
    reason: reasons,
  };
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHeaderProfileMenu, setShowHeaderProfileMenu] = useState(false);

  const loadData = useCallback(async () => {
    setApiLoading(true);
    setApiError("");

    try {
      const [transactionResponse, summaryResponse] = await Promise.all([
        fetch(`${API_URL}/api/transactions`),
        fetch(`${API_URL}/api/summary`),
      ]);

      if (!transactionResponse.ok) {
        throw new Error(`Transactions API returned ${transactionResponse.status}`);
      }
      if (!summaryResponse.ok) {
  throw new Error(`Summary API returned ${summaryResponse.status}`);
}

      const rawTransactions: ApiTransaction[] = await transactionResponse.json();
      const normalized = rawTransactions.map(normalizeTransaction);
const raw = await summaryResponse.json();

const nextSummary: Summary = {
  total: number(raw.total, normalized.length),
  high: number(raw.high, normalized.filter((t) => t.risk === "High").length),
  medium: number(raw.medium, normalized.filter((t) => t.risk === "Medium").length),
  low: number(raw.low, normalized.filter((t) => t.risk === "Low").length),
  fraud_count: number(
    raw.fraud_count,
    normalized.filter((t) => t.isFraud).length,
  ),
  total_amount: number(
    raw.total_amount,
    normalized.reduce((sum, t) => sum + t.amount, 0),
  ),
  average_risk_score: number(
    raw.average_risk_score,
    normalized.length
      ? normalized.reduce((sum, t) => sum + t.riskScore, 0) / normalized.length
      : 0,
  ),
};

      setTransactions(normalized);
      setSummary(nextSummary);
      setLastUpdated(new Date());
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Could not load data from the backend.",
      );
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const riskCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    transactions.forEach((transaction) => {
      counts[transaction.risk] += 1;
    });
    return counts;
  }, [transactions]);

  const displayedCounts = {
    High: summary?.high ?? riskCounts.High,
    Medium: summary?.medium ?? riskCounts.Medium,
    Low: summary?.low ?? riskCounts.Low,
  };

  const totalRiskCount =
    displayedCounts.High + displayedCounts.Medium + displayedCounts.Low;

  const totalAmount =
    summary?.total_amount ??
    transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  const flaggedCount = displayedCounts.High + displayedCounts.Medium;
  const fraudCount =
    summary?.fraud_count ?? transactions.filter((t) => t.isFraud).length;

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesRisk = filter === "All" || transaction.risk === filter;
      const matchesNav =
        activeNav !== "Investigations" || transaction.risk === "High";
      const matchesSearch = [
        transaction.id,
        transaction.name,
        transaction.merchant,
        transaction.type,
        transaction.location,
      ].some((value) => value.toLowerCase().includes(query));

      return matchesRisk && matchesNav && matchesSearch;
    });
  }, [transactions, filter, search, activeNav]);

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hourNow = new Date().getHours();
  const greeting =
    hourNow < 5
      ? "Good night"
      : hourNow < 12
        ? "Good morning"
        : hourNow < 17
          ? "Good afternoon"
          : hourNow < 21
            ? "Good evening"
            : "Good night";

  const displayName = currentUser?.name ?? "";

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    try {
      const user = authMode === "signup"
        ? signupUser(authName, authEmail, authPassword)
        : loginUser(authEmail, authPassword);
      setCurrentUser(user);
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setShowPassword(false);
      setAuthSuccess("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setShowProfileMenu(false);
    setShowHeaderProfileMenu(false);
    setAuthMode("login");
    setAuthError("");
  };

  const panel = darkMode
    ? "border-white/[0.08] bg-[#11182a]"
    : "border-slate-200 bg-white shadow-sm";

  const muted = darkMode ? "text-slate-400" : "text-slate-600";
  const faint = darkMode ? "text-slate-500" : "text-slate-500";
  const mainBg = darkMode ? "bg-[#0b1020] text-slate-100" : "bg-slate-50 text-slate-900";
  const sidebarBg = darkMode ? "bg-[#0e1426]" : "bg-white";
  const inputBg = darkMode ? "bg-[#0b1020]" : "bg-slate-50";
  const borderColor = darkMode ? "border-white/[0.07]" : "border-slate-200";

  
const goToNav = (label: string) => {
  setActiveNav(label);
  setSearch("");

  if (label === "Investigations") {
    setFilter("High");
  } else {
    setFilter("All");
  }

  setSelected(null);
  setShowNotifications(false);
};

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] px-4 py-10 text-slate-100">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#11182a] shadow-2xl lg:grid-cols-2">
          <div className="hidden flex-col justify-between bg-gradient-to-br from-[#111b34] via-[#11182a] to-[#1d2450] p-10 lg:flex">
            <div className="flex items-center gap-4">
              <img src={finGuardLogo} alt="FinGuard AI logo" className="h-16 w-16 rounded-2xl object-contain" />
              <div><h1 className="text-2xl font-bold">FinGuard AI</h1><p className="mt-1 text-xs tracking-[0.18em] text-slate-400">FINANCIAL RISK INTELLIGENCE</p></div>
            </div>
            <div><p className="text-sm font-semibold text-indigo-300">Financial risk monitoring</p><h2 className="mt-3 text-4xl font-bold leading-tight">See the risk.<br />Understand the signal.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">Review transaction patterns and investigate flagged activity in one workspace.</p></div>
            <p className="text-xs text-slate-500">FinGuard AI · ExaThon India 2026</p>
          </div>
          <div className="p-6 sm:p-10">
            <div className="mb-8 flex items-center gap-3 lg:hidden"><img src={finGuardLogo} alt="FinGuard AI logo" className="h-12 w-12 rounded-xl object-contain" /><div><h1 className="text-xl font-bold">FinGuard AI</h1><p className="text-[10px] tracking-wider text-slate-400">FINANCIAL RISK INTELLIGENCE</p></div></div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Secure workspace access</p>
            <h2 className="mt-3 text-3xl font-bold">{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-2 text-sm text-slate-400">{authMode === "login" ? "Sign in to continue to your risk dashboard." : "Set up your profile to access FinGuard AI."}</p>
            <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-[#0b1020] p-1">
              <button type="button" onClick={() => { setAuthMode("login"); setAuthError(""); setAuthSuccess(""); setShowPassword(false); }} className={`rounded-lg py-2.5 text-sm font-semibold ${authMode === "login" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`}>Login</button>
              <button type="button" onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthSuccess(""); setShowPassword(false); }} className={`rounded-lg py-2.5 text-sm font-semibold ${authMode === "signup" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`}>Sign up</button>
            </div>
            <form onSubmit={submitAuth} className="mt-6 space-y-4">
              {authMode === "signup" && <label className="block text-sm text-slate-300">Full name<div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b1020] px-3"><UserRound size={17} className="text-slate-500" /><input required minLength={2} value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Enter your name" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-600" /></div></label>}
              <label className="block text-sm text-slate-300">Email address<div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b1020] px-3"><Mail size={17} className="text-slate-500" /><input required type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-600" /></div></label>
              <label className="block text-sm text-slate-300">Password
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b1020] px-3 focus-within:border-indigo-400/60">
                  <LockKeyhole size={17} className="shrink-0 text-slate-500" />
                  <input required minLength={6} type={showPassword ? "text" : "password"} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={authMode === "signup" ? "new-password" : "current-password"} className="w-full min-w-0 bg-transparent py-3 text-sm outline-none placeholder:text-slate-600" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} className="shrink-0 rounded-md p-1 text-slate-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {authError && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-300">{authError}</p>}
              {authSuccess && <p className="text-sm text-emerald-300">{authSuccess}</p>}
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400">{authMode === "login" ? "Login to dashboard" : "Create account"}<ChevronRight size={17} /></button>
            </form>
            <p className="mt-5 text-xs leading-5 text-slate-500">Prototype authentication stores demo account details in this browser only. Use a secure backend authentication service before production deployment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${mainBg}`}>
      <aside className={`fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r ${borderColor} ${sidebarBg} lg:flex`}>
        <div className={`flex min-h-[92px] items-center gap-3 border-b ${borderColor} px-5 py-3`}>
          <img
            src={finGuardLogo}
            alt="FinGuard AI logo"
            className="h-12 w-12 shrink-0 rounded-xl object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">
              FinGuard<span className="text-indigo-400"> AI</span>
            </h1>
            <p className={`mt-0.5 text-[10px] tracking-wide ${faint}`}>
              FINANCIAL RISK INTELLIGENCE
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className={`mb-3 px-3 text-[10px] font-bold tracking-[0.2em] ${faint}`}>
            WORKSPACE
          </p>
          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => goToNav(label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activeNav === label
                    ? "bg-indigo-500/15 font-semibold text-indigo-500 ring-1 ring-inset ring-indigo-400/20"
                    : `${muted} hover:bg-indigo-500/10`
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
                {label === "Investigations" && (
                  <span className="ml-auto rounded-md bg-rose-500/15 px-2 py-0.5 text-xs text-rose-500">
                    {displayedCounts.High}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className={`rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-4`}>
            <div className="mb-3 flex items-center gap-2 text-indigo-400">
              <CircleHelp size={17} />
              <span className="text-sm font-semibold">FinGuard insights</span>
            </div>
            <p className={`text-xs leading-5 ${muted}`}>
              Review flagged transactions and inspect the available risk explanations.
            </p>
          
<button
  type="button"
  onClick={() => {
    setActiveNav("Risk Analysis");
    setFilter("All");
    setSearch("");
    setSelected(null);
    setShowNotifications(false);
  }}
  className="mt-3 text-xs font-semibold text-indigo-400 transition hover:text-indigo-300"
>
  Explore risk analysis →
</button>

          </div>
          <div className={`relative mt-4 border-t ${borderColor} pt-4`}>
            <button onClick={() => setShowProfileMenu((value) => !value)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-indigo-500/10`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-400">
                {displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className={`text-xs ${faint}`}>Signed in</p>
              </div>
              <ChevronDown size={16} className={faint} />
            </button>
            {showProfileMenu && <div className={`absolute bottom-full left-0 right-0 mb-2 rounded-xl border ${borderColor} ${darkMode ? "bg-[#151c30]" : "bg-white"} p-2 shadow-2xl`}>
              <div className={`px-3 py-2 ${faint}`}>
                <p className="text-[11px] uppercase tracking-wider">Signed in as</p>
                <p className="mt-1 break-all text-xs leading-5 text-slate-300">{currentUser.email}</p>
              </div>
              <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10"><LogOut size={16} />Log out</button>
            </div>}
          </div>
        </div>
      </aside>

      <main className="min-w-0 lg:ml-64">
        <header className={`sticky top-0 z-10 flex min-h-[82px] items-center justify-between border-b ${borderColor} ${darkMode ? "bg-[#0b1020]/90" : "bg-white/90"} px-4 backdrop-blur-xl sm:px-8`}>
          <div>
            <p className={`text-xs ${faint}`}>Workspace / {activeNav}</p>
            <h2 className="mt-1 text-lg font-semibold">
              {activeNav === "Dashboard" ? "Dashboard overview" : activeNav}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:flex ${
              apiError
                ? "border-rose-400/30 bg-rose-400/10 text-rose-500"
                : apiLoading
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-500"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                apiError ? "bg-rose-400" : apiLoading ? "bg-amber-400" : "bg-emerald-400"
              }`} />
              {apiError ? "API disconnected" : apiLoading ? "Connecting…" : "API connected"}
            </span>

            <button
              aria-label="Refresh dashboard"
              title="Refresh data"
              onClick={() => void loadData()}
              disabled={apiLoading}
              className={`rounded-xl border ${borderColor} p-2.5 ${muted} hover:text-indigo-400 disabled:opacity-50`}
            >
              <RefreshCw size={17} className={apiLoading ? "animate-spin" : ""} />
            </button>
            <button
              aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setDarkMode((value) => !value)}
              className={`rounded-xl border ${borderColor} p-2.5 ${muted} hover:text-indigo-400`}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              aria-label="Notifications"
              onClick={() => setShowNotifications((value) => !value)}
              className={`relative rounded-xl border ${borderColor} p-2.5 ${muted} hover:text-indigo-400`}
            >
              <Bell size={18} />
              {flaggedCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {flaggedCount}
                </span>
              )}
            </button>
            <button
              aria-label="Account menu"
              title={displayName}
              onClick={() => setShowHeaderProfileMenu((value) => !value)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${borderColor} bg-indigo-500/10 text-xs font-bold text-indigo-400 hover:bg-indigo-500/20`}
            >
              {displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </button>
          </div>

          {showHeaderProfileMenu && (
            <div className={`absolute right-4 top-[70px] z-30 w-64 rounded-xl border ${borderColor} ${darkMode ? "bg-[#151c30]" : "bg-white"} p-3 shadow-2xl sm:right-8`}>
              <p className="text-sm font-semibold">{displayName}</p>
              <p className={`mt-1 break-all text-xs leading-5 ${faint}`}>{currentUser.email}</p>
              <button onClick={handleLogout} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10"><LogOut size={16} />Log out</button>
            </div>
          )}

          {showNotifications && (
            <div className={`absolute right-4 top-[70px] z-30 w-72 rounded-xl border ${borderColor} ${darkMode ? "bg-[#151c30]" : "bg-white"} p-4 shadow-2xl`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">Notifications</p>
                <button onClick={() => setShowNotifications(false)} aria-label="Close notifications">
                  <X size={15} className={faint} />
                </button>
              </div>
              <p className={`mt-2 text-sm leading-5 ${muted}`}>
                {flaggedCount > 0
                  ? `${flaggedCount} transaction(s) are classified as high or medium risk in the current dataset.`
                  : "No high or medium-risk transactions in the current dataset."}
              </p>
              <button
                onClick={() => {
                  goToNav("Investigations");
                  setShowNotifications(false);
                }}
                className="mt-3 text-xs font-semibold text-indigo-400"
              >
                Review high-risk transactions →
              </button>
            </div>
          )}
        </header>

        <div className="mx-auto max-w-[1600px] space-y-7 p-4 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className={`text-sm ${muted}`}>{dateLabel}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {activeNav === "Dashboard" ? `${greeting}, ${displayName}` : activeNav}
                {activeNav === "Dashboard" && <span> 👋</span>}
              </h1>
              <p className={`mt-2 text-sm ${muted}`}>
                {activeNav === "Dashboard" ? "Your financial risk overview at a glance." : activeNav === "Transactions" ? "Search, filter, and inspect individual transactions." : activeNav === "Risk Analysis" ? "Explore the risk distribution and API-provided risk scores." : "Review high-risk records and their available explanations."}
              </p>
              {lastUpdated && (
                <p className={`mt-2 text-xs ${faint}`}>
                  Last refreshed: {lastUpdated.toLocaleTimeString("en-IN")}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setFilter("All");
                setSearch("");
                setActiveNav("Dashboard");
              }}
              className="flex items-center justify-center gap-2 self-start rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 sm:self-auto"
            >
              <SlidersHorizontal size={16} />
              Reset view
            </button>
          </div>

          <div className={`flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3`}>
            <span className="mt-0.5 text-amber-500">ⓘ</span>
            <p className={`text-xs leading-5 ${muted}`}>
              <span className="font-semibold text-amber-500">Prototype data:</span>{" "}
              Figures and transactions reflect the API dataset. Risk categories and fraud labels are illustrative and are not proof of real-world fraud or a validated prediction.
            </p>
          </div>

          {apiError && (
            <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-500">
              <p className="font-semibold">Could not load backend data.</p>
              <p className="mt-1">{apiError}</p>
              <p className="mt-1 text-xs">
                Confirm that FastAPI is running at {API_URL} and that both endpoints are available.
              </p>
              <button
                onClick={() => void loadData()}
                className="mt-3 rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs hover:bg-rose-400/10"
              >
                Retry connection
              </button>
            </div>
          )}

          {(activeNav === "Dashboard" || activeNav === "Risk Analysis") && (
          <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Transactions monitored"
              value={apiLoading && !transactions.length ? "…" : (summary?.total ?? transactions.length).toLocaleString("en-IN")}
              icon={Wallet}
              description="Transactions in API dataset"
              panel={panel}
              muted={muted}
              faint={faint}
              darkMode={darkMode}
              accent="indigo"
            />
            <MetricCard
              title="Total transaction amount"
              value={apiLoading && !transactions.length ? "…" : compactMoney(totalAmount)}
              icon={CreditCard}
              description="Combined sample transaction value"
              panel={panel}
              muted={muted}
              faint={faint}
              darkMode={darkMode}
              accent="blue"
            />
            <MetricCard
              title="High-risk transactions"
              value={apiLoading && !transactions.length ? "…" : displayedCounts.High.toLocaleString("en-IN")}
              icon={ShieldAlert}
              description="Classified high risk"
              panel={panel}
              muted={muted}
              faint={faint}
              darkMode={darkMode}
              accent="rose"
            />
            <MetricCard
              title="Fraud-labelled samples"
              value={apiLoading && !transactions.length ? "…" : fraudCount.toLocaleString("en-IN")}
              icon={Activity}
              description="Sample labels from the API"
              panel={panel}
              muted={muted}
              faint={faint}
              darkMode={darkMode}
              accent="amber"
            />
            <MetricCard
  title="Average risk score"
  value={
    apiLoading && !transactions.length
      ? "…"
      : `${(summary?.average_risk_score ??
          (transactions.length
            ? transactions.reduce((sum, t) => sum + t.riskScore, 0) /
              transactions.length
            : 0)
        ).toFixed(1)}/100`
  }
  icon={Activity}
  description="Average API-provided risk score"
  panel={panel}
  muted={muted}
  faint={faint}
  darkMode={darkMode}
  accent="indigo"
/>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <div className={`rounded-2xl border p-5 sm:p-6 xl:col-span-2 ${panel}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Transaction amount comparison</h3>
                  <p className={`mt-1 text-xs ${faint}`}>
                    Actual amount per transaction · INR
                  </p>
                </div>
                <span className={`rounded-lg border ${borderColor} px-3 py-2 text-xs ${muted}`}>
                  {transactions.length} records
                </span>
              </div>

              {transactions.length === 0 ? (
                <ChartEmpty loading={apiLoading} muted={muted} />
              ) : (
                <div className="mt-7">
                  <div className="flex h-56 items-end gap-3 overflow-x-auto pb-1">
                    {transactions.map((transaction) => {
                      const maxAmount = Math.max(...transactions.map((t) => t.amount), 1);
                      const height = Math.max(5, (transaction.amount / maxAmount) * 100);
                      const barColor =
                        transaction.risk === "High"
                          ? "bg-rose-400"
                          : transaction.risk === "Medium"
                            ? "bg-amber-400"
                            : "bg-indigo-400";

                      return (
                        <button
                          key={transaction.id}
                          title={`${transaction.id}: ${money(transaction.amount)}`}
                          onClick={() => setSelected(transaction)}
                          className="group flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-2"
                        >
                          <span className={`text-[10px] ${muted}`}>
                            {compactMoney(transaction.amount)}
                          </span>
                          <div className="flex h-[78%] w-full items-end">
                            <div
                              style={{ height: `${height}%` }}
                              className={`w-full rounded-t-md opacity-80 transition group-hover:opacity-100 ${barColor}`}
                            />
                          </div>
                          <span className={`max-w-full truncate text-[10px] ${faint}`}>
                            {transaction.id}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className={`mt-3 flex flex-wrap gap-4 border-t ${borderColor} pt-3 text-[11px] ${muted}`}>
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-rose-400" />High risk</span>
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Medium risk</span>
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-indigo-400" />Low risk</span>
                  </div>
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
              <h3 className="font-semibold">Risk distribution</h3>
              <p className={`mt-1 text-xs ${faint}`}>Risk classifications in the current dataset</p>

              {totalRiskCount === 0 ? (
                <ChartEmpty loading={apiLoading} muted={muted} />
              ) : (
                <>
                  <div className="flex justify-center py-6">
                    <div
                      className="relative flex h-40 w-40 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#fb7185 0% ${(displayedCounts.High / totalRiskCount) * 100}%, #fbbf24 ${(displayedCounts.High / totalRiskCount) * 100}% ${((displayedCounts.High + displayedCounts.Medium) / totalRiskCount) * 100}%, #818cf8 ${((displayedCounts.High + displayedCounts.Medium) / totalRiskCount) * 100}% 100%)`,
                      }}
                      role="img"
                      aria-label={`Risk distribution: ${displayedCounts.High} high, ${displayedCounts.Medium} medium, ${displayedCounts.Low} low`}
                    >
                      <div className={`flex h-28 w-28 flex-col items-center justify-center rounded-full ${darkMode ? "bg-[#11182a]" : "bg-white"}`}>
                        <span className="text-2xl font-bold">{totalRiskCount}</span>
                        <span className={`text-[10px] ${faint}`}>Classified</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <RiskLegend color="bg-rose-400" label="High risk" value={displayedCounts.High} total={totalRiskCount} muted={muted} faint={faint} />
                    <RiskLegend color="bg-amber-400" label="Medium risk" value={displayedCounts.Medium} total={totalRiskCount} muted={muted} faint={faint} />
                    <RiskLegend color="bg-indigo-400" label="Low risk" value={displayedCounts.Low} total={totalRiskCount} muted={muted} faint={faint} />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={`rounded-2xl border p-5 sm:p-6 ${panel}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Transaction risk scores</h3>
                <p className={`mt-1 text-xs ${faint}`}>
                  API-provided scores on a 0–100 scale
                </p>
              </div>
              <span className={`text-xs ${faint}`}>Higher score = higher classified risk</span>
            </div>

            {transactions.length === 0 ? (
              <ChartEmpty loading={apiLoading} muted={muted} />
            ) : (
              <div className="mt-5 space-y-4">
                {transactions.map((transaction) => (
                  <button
                    key={transaction.id}
                    onClick={() => setSelected(transaction)}
                    className="grid w-full grid-cols-[76px_minmax(0,1fr)_40px] items-center gap-3 text-left"
                  >
                    <span className={`truncate text-xs ${muted}`}>{transaction.id}</span>
                    <div className={`h-3 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-slate-100"}`}>
                      <div
                        className={`h-full rounded-full transition-all ${
                          transaction.risk === "High"
                            ? "bg-rose-400"
                            : transaction.risk === "Medium"
                              ? "bg-amber-400"
                              : "bg-indigo-400"
                        }`}
                        style={{ width: `${transaction.riskScore}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-semibold">{transaction.riskScore}</span>
                  </button>
                ))}
              </div>
            )}
            <p className={`mt-4 text-[11px] ${faint}`}>
              Scores come from the API response. They are not evidence of a trained or validated machine-learning model.
            </p>
          </section>
          </>
          )}

          {(activeNav === "Transactions" || activeNav === "Investigations") && (
          <section className={`overflow-hidden rounded-2xl border ${panel}`}>
            <div className={`flex flex-col justify-between gap-4 border-b ${borderColor} p-5 sm:flex-row sm:items-center sm:p-6`}>
              <div>
                <h3 className="font-semibold">
                  {activeNav === "Investigations" ? "High-risk investigations" : "Transaction monitoring"}
                </h3>
                <p className={`mt-1 text-xs ${faint}`}>
                  Search and inspect transactions returned by the backend.
                </p>
              </div>
              <label className={`flex items-center gap-2 rounded-xl border ${borderColor} ${inputBg} px-3 py-2.5 sm:w-72`}>
                <Search size={16} className={`shrink-0 ${faint}`} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ID, merchant, location…"
                  className={`w-full bg-transparent text-sm outline-none placeholder:text-slate-500 ${darkMode ? "text-slate-200" : "text-slate-800"}`}
                />
              </label>
            </div>

            <div className={`flex gap-2 overflow-x-auto border-b ${borderColor} px-5 pt-4 sm:px-6`}>
              {["All", "High", "Medium", "Low"].map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 pb-3 text-xs font-medium transition ${
                    filter === item
                      ? "border-indigo-400 text-indigo-400"
                      : `border-transparent ${faint} hover:text-indigo-400`
                  }`}
                >
                  {item === "All" ? "All transactions" : `${item} risk`}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className={`${darkMode ? "bg-white/[0.02]" : "bg-slate-50"} text-[10px] uppercase tracking-wider ${faint}`}>
                  <tr>
                    <th className="px-6 py-4 font-semibold">Transaction / Customer</th>
                    <th className="px-4 py-4 font-semibold">Type</th>
                    <th className="px-4 py-4 font-semibold">Amount</th>
                    <th className="px-4 py-4 font-semibold">Location</th>
                    <th className="px-4 py-4 font-semibold">Risk score</th>
                    <th className="px-4 py-4 font-semibold">Risk level</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? "divide-white/[0.05]" : "divide-slate-100"}`}>
                  {apiLoading && transactions.length === 0 && (
                    <tr><td colSpan={7} className={`px-6 py-10 text-center text-sm ${muted}`}>Loading transactions…</td></tr>
                  )}
                  {!apiLoading && !apiError && filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className={darkMode ? "hover:bg-white/[0.025]" : "hover:bg-slate-50"}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-400">
                            {transaction.initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{transaction.name}</p>
                            <p className={`mt-1 text-[11px] ${faint}`}>{transaction.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-sm ${muted}`}>{transaction.type}</td>
                      <td className="px-4 py-4 text-sm font-semibold">{money(transaction.amount)}</td>
                      <td className={`px-4 py-4 text-xs ${muted}`}>
                        <span className="flex items-center gap-1"><MapPin size={12} />{transaction.location}</span>
                      </td>
                      <td className="px-4 py-4 text-sm">{transaction.riskScore}/100</td>
                      <td className="px-4 py-4"><RiskBadge risk={transaction.risk} /></td>
                      <td className="px-5 py-4">
                        <button
                          aria-label={`View ${transaction.id}`}
                          onClick={() => setSelected(transaction)}
                          className={`rounded-lg p-2 ${faint} hover:bg-indigo-500/10 hover:text-indigo-400`}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!apiLoading && !apiError && filteredTransactions.length === 0 && (
                    <tr><td colSpan={7} className={`px-6 py-10 text-center text-sm ${muted}`}>No matching transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={`flex flex-col gap-2 border-t ${borderColor} px-6 py-4 text-xs ${faint} sm:flex-row sm:items-center sm:justify-between`}>
              <span>Showing {filteredTransactions.length} of {transactions.length} API transactions</span>
              <span className="flex items-center gap-2"><Clock3 size={13} />Synthetic demo dataset</span>
            </div>
          </section>
          )}

          <footer className={`flex flex-col justify-between gap-2 pb-3 text-xs ${faint} sm:flex-row`}>
            <span>FinGuard AI · ExaThon India 2026</span>
            <span>Explainable risk-monitoring prototype</span>
          </footer>
        </div>
      </main>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-3 lg:p-5"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-detail-title"
            onClick={(event) => event.stopPropagation()}
            className={`relative flex min-h-screen w-full max-w-5xl flex-col overflow-y-auto border ${borderColor} ${darkMode ? "bg-[#0f1729] text-slate-100" : "bg-white text-slate-900"} p-5 shadow-2xl sm:min-h-0 sm:max-h-[94vh] sm:rounded-2xl sm:p-7 lg:p-9`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs uppercase tracking-[0.18em] ${faint}`}>Transaction details</p>
                <h2 id="transaction-detail-title" className="mt-2 text-2xl font-bold sm:text-3xl">{selected.id}</h2>
                <p className={`mt-2 text-sm ${muted}`}>Full transaction review · sample API record</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close details" className={`rounded-lg p-2 ${muted} hover:bg-indigo-500/10`}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className={`rounded-xl border ${borderColor} p-5 sm:p-6`}>
              <p className={`text-sm ${muted}`}>Transaction amount</p>
              <p className="mt-1 text-3xl font-bold">{money(selected.amount)}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className={`text-sm ${muted}`}>Risk classification</span>
                <RiskBadge risk={selected.risk} />
              </div>
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs">
                  <span className={muted}>Risk score</span>
                  <span>{selected.riskScore}/100</span>
                </div>
                <div className={`h-2 overflow-hidden rounded-full ${darkMode ? "bg-white/10" : "bg-slate-100"}`}>
                  <div
                    className={`h-full rounded-full ${
                      selected.risk === "High" ? "bg-rose-400" : selected.risk === "Medium" ? "bg-amber-400" : "bg-indigo-400"
                    }`}
                    style={{ width: `${selected.riskScore}%` }}
                  />
                </div>
              </div>
            </div>

            <div className={`rounded-xl border ${borderColor} p-5 sm:p-6`}>
            <h3 className="mb-4 text-sm font-semibold">Transaction information</h3>
            <div className="space-y-4 text-sm">
              <DetailRow label="Customer / ID" value={selected.name} muted={muted} />
              <DetailRow label="Merchant" value={selected.merchant} muted={muted} />
              <DetailRow label="Transaction type" value={selected.type} muted={muted} />
              <DetailRow label="Location" value={selected.location} muted={muted} />
              <DetailRow label="Recorded time" value={selected.time} muted={muted} />
              <DetailRow label="Fraud label" value={selected.isFraud ? "True in sample data" : "False / not labelled"} muted={muted} />
            </div>
            </div>
            </div>

            <div className="mt-5 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] p-5 sm:p-6">
              <p className="text-sm font-semibold text-indigo-400">Risk explanation</p>
              <p className={`mt-2 text-sm leading-6 ${muted}`}>{selected.reason}</p>
              <p className={`mt-2 text-xs ${faint}`}>
                This explanation is based on API-provided information. It is not a confirmed fraud determination.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
              <button onClick={() => setSelected(null)} className={`rounded-xl border ${borderColor} px-5 py-3 text-sm font-semibold ${muted} hover:bg-indigo-500/10`}>Close details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  panel,
  muted,
  faint,
  darkMode,
  accent,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
  description: string;
  panel: string;
  muted: string;
  faint: string;
  darkMode: boolean;
  accent: "indigo" | "blue" | "rose" | "amber";
}) {
  const accents = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    blue: "text-sky-400 bg-sky-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    amber: "text-amber-400 bg-amber-500/10",
  };

  return (
    <div className={`rounded-2xl border p-5 transition hover:border-indigo-400/30 ${panel}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${muted}`}>{title}</span>
        <span className={`rounded-xl p-2 ${accents[accent]}`}><Icon size={18} /></span>
      </div>
      <p className="mt-5 break-words text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      <p className={`mt-3 text-[11px] ${faint}`}>{description}</p>
      <div className={`mt-4 h-1 overflow-hidden rounded-full ${darkMode ? "bg-white/[0.05]" : "bg-slate-100"}`}>
        <div className={`h-full w-2/3 rounded-full ${accent === "rose" ? "bg-rose-400" : accent === "amber" ? "bg-amber-400" : accent === "blue" ? "bg-sky-400" : "bg-indigo-400"}`} />
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  const styles = {
    High: "bg-rose-400/10 text-rose-500 ring-rose-400/20",
    Medium: "bg-amber-400/10 text-amber-500 ring-amber-400/20",
    Low: "bg-indigo-400/10 text-indigo-500 ring-indigo-400/20",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[risk]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {risk}
    </span>
  );
}

function RiskLegend({
  color,
  label,
  value,
  total,
  muted,
  faint,
}: {
  color: string;
  label: string;
  value: number;
  total: number;
  muted: string;
  faint: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className={`flex-1 ${muted}`}>{label}</span>
      <span className="font-semibold">{value}</span>
      <span className={`w-12 text-right ${faint}`}>{percentage.toFixed(1)}%</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className={muted}>{label}</span>
      <span className="max-w-[65%] break-words text-right font-medium">{value}</span>
    </div>
  );
}

function ChartEmpty({ loading, muted }: { loading: boolean; muted: string }) {
  return (
    <div className={`flex h-48 flex-col items-center justify-center gap-3 text-sm ${muted}`}>
      {loading ? <RefreshCw size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
      {loading ? "Loading chart data…" : "No transaction data available"}
    </div>
  );
}

export default App;
