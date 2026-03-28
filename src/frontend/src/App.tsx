import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FlaskConical,
  History,
  Loader2,
  LogOut,
  Pill,
  Settings,
  ShieldCheck,
  Upload,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

// ------- Types -------
interface ScanResult {
  medicine_name: string;
  manufacturing_date: string;
  expiry_date: string;
  error?: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  result: ScanResult;
  imageUrl: string;
}

// ------- Constants -------
const STORAGE_KEY_API = "Health_Key";
const STORAGE_KEY_HISTORY = "health_door_history";
const MAX_HISTORY = 5;

// ------- Helpers -------
function getExpiryStatus(expiryDate: string): "valid" | "expired" | "unknown" {
  if (!expiryDate || expiryDate === "Not detected") return "unknown";
  let parsedDate: Date | null = null;

  const mmYYYY = expiryDate.match(/(\d{2})\/(\d{4})/);
  const mmYY = expiryDate.match(/(\d{2})\/(\d{2})$/);
  const monYYYY = expiryDate.match(/([A-Za-z]{3})\s*(\d{4})/);

  if (mmYYYY) {
    parsedDate = new Date(
      Number.parseInt(mmYYYY[2]),
      Number.parseInt(mmYYYY[1]) - 1,
      1,
    );
  } else if (mmYY) {
    parsedDate = new Date(
      2000 + Number.parseInt(mmYY[2]),
      Number.parseInt(mmYY[1]) - 1,
      1,
    );
  } else if (monYYYY) {
    parsedDate = new Date(`${monYYYY[1]} 1 ${monYYYY[2]}`);
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return "unknown";
  const endOfMonth = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth() + 1,
    0,
  );
  return endOfMonth >= new Date() ? "valid" : "expired";
}

function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeImage(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<ScanResult> {
  const prompt = `You are an OCR system for medicine strips. Analyze this image and extract: medicine name, manufacturing date (MFG/MFD), and expiry date (EXP/USE BEFORE). Return ONLY valid JSON: {"medicine_name": "...", "manufacturing_date": "...", "expiry_date": "..."}. If a value cannot be clearly read, use "Not detected". Never guess or fabricate. If image quality is too poor, return {"error": "Image quality is too poor. Please upload a clearer image focusing on the medicine strip."}. Do not include markdown code fences or any text outside the JSON object.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 400 || response.status === 403) {
      throw new Error(
        "Invalid API key. Please check your Gemini API key in settings.",
      );
    }
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = text.replace(/```[a-z]*\n?/gi, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("Failed to parse AI response. Please try again.");
  }
}

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(
    STORAGE_KEY_HISTORY,
    JSON.stringify(items.slice(0, MAX_HISTORY)),
  );
}

// ------- StatusBadge -------
function StatusBadge({ status }: { status: "valid" | "expired" | "unknown" }) {
  if (status === "valid") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success/10 text-success">
        <CheckCircle2 className="w-3.5 h-3.5" /> Valid
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">
        <AlertCircle className="w-3.5 h-3.5" /> Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
      <Clock className="w-3.5 h-3.5" /> Unknown
    </span>
  );
}

// ------- ResultCard -------
function ResultCard({ result }: { result: ScanResult }) {
  const status = getExpiryStatus(result.expiry_date);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="bg-card rounded-2xl shadow-card border border-border p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Pill className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Medicine
          </span>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="text-xl font-bold text-foreground mb-5 leading-tight">
        {result.medicine_name || "Not detected"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">
              MFG Date
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {result.manufacturing_date || "Not detected"}
          </p>
        </div>
        <div className="bg-muted/60 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">
              EXP Date
            </span>
          </div>
          <p
            className={`text-sm font-semibold ${
              status === "expired"
                ? "text-destructive"
                : status === "valid"
                  ? "text-success"
                  : "text-foreground"
            }`}
          >
            {result.expiry_date || "Not detected"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ------- HistoryCard -------
function HistoryCard({ item, index }: { item: HistoryItem; index: number }) {
  const status = getExpiryStatus(item.result.expiry_date);
  return (
    <motion.div
      data-ocid={`history.item.${index + 1}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className="bg-card rounded-xl border border-border p-4 flex gap-3 items-start shadow-xs hover:shadow-card transition-shadow"
    >
      <img
        src={item.imageUrl}
        alt="scan"
        className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">
          {item.result.medicine_name || "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          EXP: {item.result.expiry_date || "N/A"}
        </p>
        <div className="mt-2">
          <StatusBadge status={status} />
        </div>
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {new Date(item.timestamp).toLocaleDateString()}
      </span>
    </motion.div>
  );
}

// ------- AuthButton -------
function AuthButton() {
  const { identity, login, clear, isLoggingIn, isInitializing } =
    useInternetIdentity();

  if (isInitializing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Loading...
        </span>
      </div>
    );
  }

  if (isLoggingIn) {
    return (
      <Button size="sm" disabled className="gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Signing in...</span>
      </Button>
    );
  }

  if (identity && !identity.getPrincipal().isAnonymous()) {
    const principal = identity.getPrincipal().toString();
    const shortId = principal.slice(0, 8);
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3 text-primary-foreground" />
          </div>
          <span
            className="text-xs font-mono font-semibold text-primary"
            title={principal}
          >
            {shortId}…
          </span>
        </div>
        <Button
          data-ocid="auth.logout_button"
          variant="outline"
          size="sm"
          onClick={clear}
          className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log Out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      data-ocid="auth.sign_in_button"
      size="sm"
      onClick={login}
      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
    >
      <User className="w-3.5 h-3.5" />
      Sign In
    </Button>
  );
}

// ------- Main App -------
export default function App() {
  const { identity } = useInternetIdentity();
  const { actor } = useActor();
  const isLoggedIn = !!identity && !identity.getPrincipal().isAnonymous();

  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(STORAGE_KEY_API) || "",
  );
  const [keyInput, setKeyInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [loadingBackendHistory, setLoadingBackendHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  // Load scan history from backend when logged in
  useEffect(() => {
    if (!isLoggedIn || !actor) return;
    setLoadingBackendHistory(true);
    actor
      .getScans()
      .then((scans) => {
        const backendItems: HistoryItem[] = scans.map((s) => ({
          id: `backend-${s.timestamp}`,
          timestamp: Number(s.timestamp),
          result: {
            medicine_name: s.medicine_name,
            manufacturing_date: s.manufacturing_date,
            expiry_date: s.expiry_date,
          },
          imageUrl: s.imageUrl,
        }));
        setHistory(backendItems.slice(0, MAX_HISTORY));
      })
      .catch(() => {
        // silently fall back to local history
      })
      .finally(() => setLoadingBackendHistory(false));
  }, [isLoggedIn, actor]);

  // When user logs out, reload from localStorage
  useEffect(() => {
    if (!isLoggedIn) {
      setHistory(loadHistory());
    }
  }, [isLoggedIn]);

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file.");
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setSelectedFile(file);
      setPreviewUrl(url);
      setResult(null);
      setErrorMsg(null);
    },
    [previewUrl],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return;
    if (!apiKey) {
      setSettingsOpen(true);
      toast.error("Please add your Gemini API key first.");
      return;
    }
    setAnalyzing(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const base64 = await imageToBase64(selectedFile);
      const res = await analyzeImage(
        apiKey,
        base64,
        selectedFile.type || "image/jpeg",
      );
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setResult(res);
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          result: res,
          imageUrl: previewUrl!,
        };
        const newHistory = [item, ...history].slice(0, MAX_HISTORY);
        setHistory(newHistory);

        if (isLoggedIn && actor) {
          actor
            .saveScan(
              res.medicine_name || "",
              res.manufacturing_date || "",
              res.expiry_date || "",
              previewUrl || "",
            )
            .catch(() => {
              // silently handle
            });
        } else {
          saveHistory(newHistory);
        }

        toast.success("Analysis complete!");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [selectedFile, apiKey, previewUrl, history, isLoggedIn, actor]);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      toast.error("API key cannot be empty.");
      return;
    }
    localStorage.setItem(STORAGE_KEY_API, trimmed);
    setApiKey(trimmed);
    setKeyInput("");
    setShowKey(false);
    setSettingsOpen(false);
    toast.success("Health_Key saved!");
  };

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster position="top-right" />

      {/* ---- HEADER ---- */}
      <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-sm border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              Health Door
            </span>
          </div>
          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-ocid="header.settings_button"
              onClick={() => {
                setKeyInput(apiKey);
                setShowKey(false);
                setSettingsOpen(true);
              }}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* ---- API KEY BANNER ---- */}
      <AnimatePresence>
        {!apiKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🔑</span>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  <span className="font-semibold">Setup required:</span> To
                  start scanning, you need a free Gemini API key.{" "}
                  <span className="hidden sm:inline text-amber-600 dark:text-amber-300">
                    It's free and takes 1 minute to set up.
                  </span>
                </p>
              </div>
              <button
                type="button"
                data-ocid="banner.open_modal_button"
                onClick={() => {
                  setKeyInput("");
                  setShowKey(false);
                  setSettingsOpen(true);
                }}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Set Up Now →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        {/* ---- HERO ---- */}
        <section className="bg-background py-16 md:py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Left */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-3 py-1">
                  AI-Powered Medicine Scanner
                </Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.1] tracking-tight mb-5">
                  Know What You're
                  <span className="text-primary"> Taking.</span>
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  Upload a photo of any medicine strip. Our AI instantly
                  extracts the medicine name, manufacturing date, and expiry
                  status — so you never take an expired medicine again.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    data-ocid="hero.primary_button"
                    onClick={scrollToUpload}
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base font-semibold px-8 h-12 rounded-xl shadow-card"
                  >
                    Scan Now <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="gap-2 text-base text-muted-foreground hover:text-foreground h-12"
                    onClick={() =>
                      document
                        .getElementById("how-it-works")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <Eye className="w-4 h-4" /> How it works
                  </Button>
                </div>
                <div className="mt-8 flex items-center gap-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success" /> Instant
                    results
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success" />{" "}
                    Privacy-first
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success" /> Free to
                    use
                  </div>
                </div>
              </motion.div>
              {/* Right — illustration */}
              <motion.div
                initial={{ opacity: 0, x: 30, rotate: -2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ duration: 0.65, ease: "easeOut", delay: 0.1 }}
                className="relative flex justify-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-3xl scale-110" />
                  <img
                    src="/assets/generated/hero-pill-strip.dim_600x500.png"
                    alt="Medicine strip scan"
                    className="relative rounded-2xl shadow-card-hover w-full max-w-md rotate-3 hover:rotate-1 transition-transform duration-500"
                  />
                  {/* floating badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="absolute -bottom-4 -left-4 bg-card rounded-xl shadow-card border border-border px-4 py-3 flex items-center gap-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Valid
                      </p>
                      <p className="text-xs text-muted-foreground">
                        EXP: 03/2026
                      </p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ---- UPLOAD MODULE ---- */}
        <section ref={uploadSectionRef} className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-card rounded-2xl shadow-card border border-border p-8"
            >
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Upload & Scan Medicine
              </h2>
              <p className="text-muted-foreground mb-6 text-sm">
                Drag a photo or use your camera to extract medicine details
                instantly.
              </p>

              {/* Dropzone */}
              <div
                data-ocid="upload.dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
                  dragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <AnimatePresence mode="wait">
                  {previewUrl ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative p-4"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setResult(null);
                          setErrorMsg(null);
                        }}
                        className="absolute top-6 right-6 z-10 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
                        aria-label="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full max-h-64 object-contain rounded-lg"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-12 flex flex-col items-center gap-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-foreground">
                          Click or Drag to Upload
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          PNG, JPG, WEBP supported
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          data-ocid="upload.upload_button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-semibold hover:bg-primary/20 transition-colors"
                        >
                          <Upload className="w-4 h-4" /> Browse File
                        </button>
                        <span className="text-muted-foreground text-xs">
                          or
                        </span>
                        <button
                          type="button"
                          data-ocid="upload.camera_button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-semibold hover:bg-muted/80 hover:text-foreground transition-colors"
                        >
                          <Camera className="w-4 h-4" /> Scan with Camera
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Analyze button */}
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  <Button
                    data-ocid="upload.submit_button"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4" /> Analyze Medicine
                        Strip
                      </>
                    )}
                  </Button>
                </motion.div>
              )}

              {/* Loading state */}
              {analyzing && (
                <div
                  data-ocid="upload.loading_state"
                  className="mt-5 bg-primary/5 rounded-xl p-4 flex items-center gap-3"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      AI is analyzing your image...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This usually takes 2–5 seconds
                    </p>
                  </div>
                </div>
              )}

              {/* Error state */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    data-ocid="upload.error_state"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-5 bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-destructive">
                        Analysis Failed
                      </p>
                      <p className="text-xs text-destructive/80 mt-0.5">
                        {errorMsg}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-ocid="upload.retry_button"
                      onClick={handleAnalyze}
                      className="text-xs font-semibold text-destructive underline underline-offset-2 flex-shrink-0"
                    >
                      Retry
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Gemini API key settings */}
              <div className="mt-6 pt-5 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Health_Key (API Key)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {apiKey
                        ? `Key set: ${apiKey.slice(0, 8)}...`
                        : "No key configured"}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-ocid="upload.settings_button"
                    onClick={() => {
                      setKeyInput(apiKey);
                      setShowKey(false);
                      setSettingsOpen(true);
                    }}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" />{" "}
                    {apiKey ? "Update" : "Add Key"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ---- RESULTS ---- */}
        <AnimatePresence>
          {result && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pb-12 px-4 sm:px-6 lg:px-8"
            >
              <div className="max-w-3xl mx-auto">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  Scan Results
                </h2>
                <ResultCard result={result} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ---- HISTORY ---- */}
        {(history.length > 0 || loadingBackendHistory) && (
          <section className="pb-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4.5 h-4.5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">
                  Recent Scans
                </h2>
                {!loadingBackendHistory && (
                  <Badge variant="secondary" className="text-xs">
                    {history.length}
                  </Badge>
                )}
                {loadingBackendHistory && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                )}
                {isLoggedIn && (
                  <span className="ml-auto text-xs text-primary font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Synced to account
                  </span>
                )}
              </div>
              {loadingBackendHistory ? (
                <div
                  data-ocid="history.loading_state"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="bg-card rounded-xl border border-border p-4 h-24 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {history.map((item, i) => (
                    <HistoryCard key={item.id} item={item} index={i} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- HOW IT WORKS ---- */}
        <section
          id="how-it-works"
          className="bg-secondary py-20 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-3">
                How It Works
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Three simple steps to verify your medicine's safety in seconds.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: <Upload className="w-6 h-6 text-primary" />,
                  step: "01",
                  title: "Upload Photo",
                  desc: "Take a photo or upload an image of your medicine strip from any angle. Camera or gallery both work.",
                },
                {
                  icon: <FlaskConical className="w-6 h-6 text-primary" />,
                  step: "02",
                  title: "AI Analysis",
                  desc: "Google Gemini Vision AI reads the strip text, identifies the medicine name, MFG date, and expiry date.",
                },
                {
                  icon: <ShieldCheck className="w-6 h-6 text-primary" />,
                  step: "03",
                  title: "Review Results",
                  desc: "Instantly see if your medicine is valid or expired, with clearly structured extracted data.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                  className="bg-card rounded-2xl border border-border p-6 shadow-xs relative overflow-hidden"
                >
                  <span className="absolute top-4 right-4 text-5xl font-black text-border select-none">
                    {item.step}
                  </span>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ---- FOOTER ---- */}
      <footer
        className="py-10 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: "oklch(0.18 0.04 222)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-white">Health Door</span>
            </div>
            <p className="text-xs" style={{ color: "oklch(0.7 0.02 220)" }}>
              © {new Date().getFullYear()} Health Door. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white transition-colors"
              >
                caffeine.ai
              </a>
            </p>
            <div
              className="flex items-center gap-4 text-xs"
              style={{ color: "oklch(0.7 0.02 220)" }}
            >
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ---- SETTINGS DIALOG ---- */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent data-ocid="settings.dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-primary" />
              Setup Your Health_Key (API Key)
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-5">
            {/* Step-by-step guide */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                How to get your free API key:
              </p>

              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary-foreground">
                    1
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Go to Google AI Studio
                  </p>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Open Google AI Studio →
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Sign in with your Google account
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use any Gmail or Google account — it's free.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Click "Create API key" and copy it
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The key starts with{" "}
                    <span className="font-mono bg-muted px-1 rounded">
                      AIza
                    </span>
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">4</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Paste the key below and click Save
                  </p>
                </div>
              </div>
            </div>

            {/* Key input */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                htmlFor="api-key-input"
              >
                Paste your Health_Key here
              </label>
              <div className="relative">
                <Input
                  data-ocid="settings.input"
                  id="api-key-input"
                  type={showKey ? "text" : "password"}
                  placeholder="AIza..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  data-ocid="settings.toggle"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {apiKey && (
                <p className="text-xs text-muted-foreground">
                  Current key:{" "}
                  <span className="font-mono">{apiKey.slice(0, 12)}...</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                🔒 Your key is stored only in your browser and never sent to our
                servers.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              data-ocid="settings.cancel_button"
              variant="outline"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="settings.save_button"
              onClick={handleSaveKey}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save Health_Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
