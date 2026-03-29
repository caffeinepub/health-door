import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FlaskConical,
  History,
  Loader2,
  LogOut,
  Mic,
  MicOff,
  Pill,
  RotateCcw,
  ShieldCheck,
  Upload,
  User,
  Volume2,
  VolumeX,
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
  rawOcrText?: string;
  how_to_use?: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  result: ScanResult;
  imageUrl: string;
}

interface LangTemplate {
  medicine: string;
  mfg: string;
  exp: string;
  status: string;
  valid: string;
  expired: string;
  unknown: string;
}

// ------- Multi-language templates -------
const LANG_TEMPLATES: Record<string, LangTemplate> = {
  "en-US": {
    medicine: "Medicine",
    mfg: "Manufacturing date",
    exp: "Expiry date",
    status: "Status",
    valid: "Valid",
    expired: "Expired",
    unknown: "Unknown",
  },
  "hi-IN": {
    medicine: "दवा",
    mfg: "निर्माण तिथि",
    exp: "समाप्ति तिथि",
    status: "स्थिति",
    valid: "वैध",
    expired: "समाप्त",
    unknown: "अज्ञात",
  },
  "es-ES": {
    medicine: "Medicamento",
    mfg: "Fecha de fabricación",
    exp: "Fecha de vencimiento",
    status: "Estado",
    valid: "Válido",
    expired: "Vencido",
    unknown: "Desconocido",
  },
  "fr-FR": {
    medicine: "Médicament",
    mfg: "Date de fabrication",
    exp: "Date d'expiration",
    status: "Statut",
    valid: "Valide",
    expired: "Expiré",
    unknown: "Inconnu",
  },
  "ar-SA": {
    medicine: "دواء",
    mfg: "تاريخ الصنع",
    exp: "تاريخ انتهاء الصلاحية",
    status: "الحالة",
    valid: "صالح",
    expired: "منتهي الصلاحية",
    unknown: "غير معروف",
  },
  "zh-CN": {
    medicine: "药品",
    mfg: "生产日期",
    exp: "有效期",
    status: "状态",
    valid: "有效",
    expired: "已过期",
    unknown: "未知",
  },
  "de-DE": {
    medicine: "Medikament",
    mfg: "Herstellungsdatum",
    exp: "Verfallsdatum",
    status: "Status",
    valid: "Gültig",
    expired: "Abgelaufen",
    unknown: "Unbekannt",
  },
  "pt-BR": {
    medicine: "Medicamento",
    mfg: "Data de fabricação",
    exp: "Data de validade",
    status: "Status",
    valid: "Válido",
    expired: "Vencido",
    unknown: "Desconhecido",
  },
  "ru-RU": {
    medicine: "Лекарство",
    mfg: "Дата производства",
    exp: "Срок годности",
    status: "Статус",
    valid: "Действительно",
    expired: "Просрочено",
    unknown: "Неизвестно",
  },
  "ja-JP": {
    medicine: "薬",
    mfg: "製造日",
    exp: "有効期限",
    status: "状態",
    valid: "有効",
    expired: "期限切れ",
    unknown: "不明",
  },
  "ta-IN": {
    medicine: "மருந்து",
    mfg: "தயாரிப்பு தேதி",
    exp: "காலாவதி தேதி",
    status: "நிலை",
    valid: "செல்லுபடியாகும்",
    expired: "காலாவதியானது",
    unknown: "தெரியவில்லை",
  },
  "ur-PK": {
    medicine: "دوا",
    mfg: "تاریخ تیاری",
    exp: "میعاد ختم ہونے کی تاریخ",
    status: "حالت",
    valid: "درست",
    expired: "میعاد ختم",
    unknown: "نامعلوم",
  },
  "te-IN": {
    medicine: "మందు",
    mfg: "తయారీ తేదీ",
    exp: "గడువు తేదీ",
    status: "స్థితి",
    valid: "చెల్లుబాటు అవుతుంది",
    expired: "గడువు ముగిసింది",
    unknown: "తెలియదు",
  },
};

const LANGUAGES = [
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "hi-IN", label: "Hindi", flag: "🇮🇳" },
  { code: "es-ES", label: "Español", flag: "🇪🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "ar-SA", label: "العربية", flag: "🇸🇦" },
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "de-DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
  { code: "ru-RU", label: "Русский", flag: "🇷🇺" },
  { code: "ja-JP", label: "日本語", flag: "🇯🇵" },
  { code: "ta-IN", label: "தமிழ்", flag: "🇮🇳" },
  { code: "ur-PK", label: "اردو", flag: "🇵🇰" },
  { code: "te-IN", label: "తెలుగు", flag: "🇮🇳" },
];

// ------- Constants -------
const STORAGE_KEY_HISTORY = "health_door_history";
const MAX_HISTORY = 5;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// 3-letter month abbreviations for OCR noise normalization
const MONTH_ABBR: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

/** Normalize OCR noise in raw text */
function normalizeOcrText(raw: string): string {
  let t = raw;
  // Fix zero -> O in month abbreviations (e.g. JAN -> JAN, but 0CT -> OCT)
  t = t.replace(/\b0CT\b/gi, "OCT");
  t = t.replace(/\b0EC\b/gi, "DEC");
  t = t.replace(/\b0AN\b/gi, "JAN");
  // Fix lowercase L -> 1 in date digit positions (e.g. 0l/2024)
  t = t.replace(/(\d)l([\/\-\.])(\d)/g, "$11$2$3");
  t = t.replace(/([\/\-\.])(l)(\d)/g, "$11$3");
  // Remove spaces inserted mid-date by OCR (e.g. "12 / 2024" -> "12/2024")
  t = t.replace(/(\d)\s*[\/\-\.]\s*(\d)/g, (_, a, b) => `${a}/${b}`);
  // Normalize line endings
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return t;
}

/** Format an extracted date string into "Month YYYY" for display only. */
function formatDateDisplay(dateStr: string): string {
  if (!dateStr || dateStr === "Not detected") return dateStr;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddMMYYYY = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddMMYYYY) {
    const m = Number(ddMMYYYY[2]) - 1;
    const y = Number(ddMMYYYY[3]);
    if (m >= 0 && m <= 11) return `${MONTH_NAMES[m]} ${y}`;
  }

  // MM/YYYY or MM-YYYY or MM.YYYY
  const mmYYYY = dateStr.match(/^(\d{1,2})[\/\-\.](\d{4})$/);
  if (mmYYYY) {
    const m = Number(mmYYYY[1]) - 1;
    const y = Number(mmYYYY[2]);
    if (m >= 0 && m <= 11) return `${MONTH_NAMES[m]} ${y}`;
  }

  // MM/YY or MM-YY
  const mmYY = dateStr.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (mmYY) {
    const m = Number(mmYY[1]) - 1;
    const y = 2000 + Number(mmYY[2]);
    if (m >= 0 && m <= 11) return `${MONTH_NAMES[m]} ${y}`;
  }

  // YYYY/MM or YYYY-MM
  const yyyyMM = dateStr.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (yyyyMM) {
    const y = Number(yyyyMM[1]);
    const m = Number(yyyyMM[2]) - 1;
    if (m >= 0 && m <= 11) return `${MONTH_NAMES[m]} ${y}`;
  }

  // Full month name + year (e.g. "JANUARY 2026" or "January 2026")
  const fullMonYYYY = dateStr.match(/^([A-Za-z]{4,9})\s+(\d{4})$/);
  if (fullMonYYYY) {
    const abbr = fullMonYYYY[1].toUpperCase().slice(0, 3);
    const idx = MONTH_ABBR[abbr];
    if (idx !== undefined) return `${MONTH_NAMES[idx]} ${fullMonYYYY[2]}`;
  }

  // MON/YYYY or MON-YYYY or MON YYYY (3-letter month)
  const monYYYY = dateStr.match(/^([A-Za-z]{3})[\/\-\s](\d{4})$/);
  if (monYYYY) {
    const d = new Date(`${monYYYY[1]} 1 ${monYYYY[2]}`);
    if (!Number.isNaN(d.getTime())) {
      return `${MONTH_NAMES[d.getMonth()]} ${monYYYY[2]}`;
    }
  }

  // MON/YY or MON-YY
  const monYY = dateStr.match(/^([A-Za-z]{3})[\/\-\s](\d{2})$/);
  if (monYY) {
    const d = new Date(`${monYY[1]} 1 20${monYY[2]}`);
    if (!Number.isNaN(d.getTime())) {
      return `${MONTH_NAMES[d.getMonth()]} ${2000 + Number(monYY[2])}`;
    }
  }

  return dateStr;
}

// ------- Helpers -------
// ------- Helpers -------
/** Parse a date string found in OCR text into a JS Date for comparison. */
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddMMYYYY = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddMMYYYY) {
    const d = new Date(
      Number(ddMMYYYY[3]),
      Number(ddMMYYYY[2]) - 1,
      Number(ddMMYYYY[1]),
    );
    if (!Number.isNaN(d.getTime())) return d;
  }

  // MM/YYYY or MM-YYYY or MM.YYYY
  const mmYYYY = s.match(/^(\d{1,2})[\/\-\.](\d{4})$/);
  if (mmYYYY) {
    const d = new Date(Number(mmYYYY[2]), Number(mmYYYY[1]) - 1, 1);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // YYYY/MM or YYYY-MM
  const yyyyMM = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (yyyyMM) {
    const d = new Date(Number(yyyyMM[1]), Number(yyyyMM[2]) - 1, 1);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // MM/YY or MM-YY
  const mmYY = s.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (mmYY) {
    const d = new Date(2000 + Number(mmYY[2]), Number(mmYY[1]) - 1, 1);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // MON/YYYY or MON-YYYY or MON YYYY
  const monYYYY = s.match(/^([A-Za-z]{3})[\/\-\s](\d{4})$/);
  if (monYYYY) {
    const d = new Date(`${monYYYY[1]} 1 ${monYYYY[2]}`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // MON/YY or MON-YY
  const monYY = s.match(/^([A-Za-z]{3})[\/\-\s](\d{2})$/);
  if (monYY) {
    const d = new Date(`${monYY[1]} 1 20${monYY[2]}`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Full month name + YYYY
  const fullMon = s.match(/^([A-Za-z]{4,9})\s+(\d{4})$/);
  if (fullMon) {
    const d = new Date(`${fullMon[1]} 1 ${fullMon[2]}`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function extractMedicineData(
  primaryText: string,
  combinedText: string,
): ScanResult {
  // Normalize OCR noise
  const text = normalizeOcrText(combinedText).replace(/[|]/g, "I");
  const primaryNorm = normalizeOcrText(primaryText).replace(/[|]/g, "I");

  const _lines = primaryNorm
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- Expiry date ---
  let expiry_date = "Not detected";
  const expPatterns = [
    /EXP\.?\s*(?:DATE\s*)?:?\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/i,
    /(?:EXPIRY|EXPN)\s*(?:DATE)?\s*:?\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/i,
    /USE\s*(?:BEFORE|BY)\s*:?\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/i,
    // Indian medicine common format: MM-YYYY or MM/YYYY after EXP label
    /EXP\.?\s*:?\s*(\d{2}[\/\-]\d{4})/i,
    // "Exp Date" followed by month name
    /EXP(?:IRY)?\s+DATE\s*:?\s*([A-Za-z]{3,9}\.?\s*\d{4})/i,
    // DD/MM/YYYY style
    /(?:EXP(?:IRY)?(?:\s+DATE)?|USE\s+(?:BEFORE|BY)|BEST\s+BEFORE|BB|VALID\s+(?:UPTO|TILL)|UPTO|BEFORE)[:\s.]*(\d{1,2}[\/\-\.](\d{1,2})[\/\-\.](\d{4}))/i,
    // Classic label: date with optional 3-letter month prefix
    /(?:EXP(?:IRY)?(?:\s+DATE)?|USE\s+(?:BEFORE|BY)|BEST\s+BEFORE|BB|VALID\s+(?:UPTO|TILL)|UPTO|BEFORE)[:\s.]*([A-Za-z]{0,3}\.?\s*\d{1,2}[\/\-\.]\d{2,4})/i,
    // Full month name
    /(?:EXP(?:IRY)?(?:\s+DATE)?|USE\s+(?:BEFORE|BY)|BEST\s+BEFORE|VALID\s+(?:UPTO|TILL))[:\s.]*([A-Za-z]{3,9}[\s\-]+\d{2,4})/i,
    // YYYY/MM style
    /(?:EXP(?:IRY)?\.?)[:\s.]*(\d{4}[\/\-]\d{1,2})/i,
    // DD/MM/YYYY standalone exp
    /EXP[:\s.]+(\d{2}[\/\-\.](\d{2})[\/\-\.](\d{4}))/i,
    // MM/YYYY
    /EXP[:\s.]+(\d{2}[\/\-\.]\d{4})/i,
    // MM/YY
    /EXP[:\s.]+(\d{2}[\/\-\.]\d{2})\b/i,
    /(?:USE\s+BEFORE|USE\sBY|EXPIRY\s+DATE|EXPIRY|MFGDT)[:\s.]*(\d{2}[\/\-\.]\d{2,4})/i,
  ];
  for (const p of expPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      expiry_date = m[1].trim();
      break;
    }
  }

  // --- Manufacturing date ---
  let manufacturing_date = "Not detected";
  const mfgPatterns = [
    /MFG\.?\s*(?:DATE\s*)?:?\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/i,
    /MFD\.?\s*(?:DATE\s*)?:?\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/i,
    /(?:MANUFACTURED\s+ON|DATE\s+OF\s+MFG)\s*:?\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/i,
    /MFG\.?\s*:?\s*(\d{2}[\/\-]\d{4})/i,
    /MFG(?:\s+DATE)?\s*:?\s*([A-Za-z]{3,9}\.?\s*\d{4})/i,
    // DD/MM/YYYY style
    /(?:MFG\.?|MFD\.?|MFGD\.?|DOM\.?|DATE\s+OF\s+MFG\.?|MANUFACTURING\s+DATE|MFD\s+ON|MFGDT\.?)[:\s.]*(\d{1,2}[\/\-\.](\d{1,2})[\/\-\.](\d{4}))/i,
    // Classic label: date with optional 3-letter month prefix
    /(?:MFG\.?|MFD\.?|MFGD\.?|DOM\.?|DATE\s+OF\s+MFG\.?|MANUFACTURING\s+DATE|MFD\s+ON|MANUFACTURED)[:\s.]*([A-Za-z]{0,3}\.?\s*\d{1,2}[\/\-\.]\d{2,4})/i,
    // Full month name
    /(?:MFG\.?|MFD\.?|MANUFACTURING\s+DATE|DATE\s+OF\s+MFG)[:\s.]*([A-Za-z]{3,9}[\s\-]+\d{2,4})/i,
    // YYYY/MM style
    /(?:MFG\.?|MFD\.?)[:\s.]*(\d{4}[\/\-]\d{1,2})/i,
    // MM/YYYY
    /MFG[:\s.]+(\d{2}[\/\-\.]\d{4})/i,
    // MM/YY
    /MFG[:\s.]+(\d{2}[\/\-\.]\d{2})\b/i,
    /(?:DATE\s+OF\s+MFG|DOM|MFD\s+ON|MFGDT)[:\s.]*(\d{2}[\/\-\.]\d{2,4})/i,
  ];
  for (const p of mfgPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      manufacturing_date = m[1].trim();
      break;
    }
  }

  // --- Generic fallback date extraction ---
  if (expiry_date === "Not detected" || manufacturing_date === "Not detected") {
    const genericPatterns = [
      /(\d{1,2}[\/\-\.](\d{1,2})[\/\-\.](\d{4}))/g, // DD/MM/YYYY
      /(\d{2})[\/\-\.](\d{4})/g, // MM/YYYY
      /(\d{4})[\/\-](\d{2})\b/g, // YYYY/MM
      /(\d{2})[\/\-](\d{2})\b/g, // MM/YY
      /([A-Za-z]{3})[\/\-\s](\d{4})\b/g, // MON/YYYY
      /([A-Za-z]{3})[\/\-\s](\d{2})\b/g, // MON/YY
      /([A-Z][a-z]{3,8})\s+(\d{4})\b/g, // Full month name + YYYY
    ];

    const foundDates: string[] = [];
    for (const pattern of genericPatterns) {
      const matches = Array.from(
        text.matchAll(new RegExp(pattern.source, pattern.flags)),
      );
      for (const m of matches) {
        const candidate = m[0].trim();
        const parsed = parseDate(candidate);
        if (parsed && !foundDates.includes(candidate)) {
          const yr = parsed.getFullYear();
          if (yr >= 2000 && yr <= 2040) {
            foundDates.push(candidate);
          }
        }
      }
    }

    if (foundDates.length >= 2) {
      const sorted = foundDates.sort((a, b) => {
        const da = parseDate(a);
        const db = parseDate(b);
        if (!da || !db) return 0;
        return da.getTime() - db.getTime();
      });
      // Smarter assignment: future/closer date = EXP, earlier = MFG
      const now = new Date();
      const futureDate = sorted.find((d) => {
        const p = parseDate(d);
        return p && p >= now;
      });
      const pastDate = sorted.find((d) => {
        const p = parseDate(d);
        return p && p < now;
      });
      if (manufacturing_date === "Not detected") {
        manufacturing_date = pastDate || sorted[0];
      }
      if (expiry_date === "Not detected") {
        expiry_date = futureDate || sorted[sorted.length - 1];
      }
    } else if (foundDates.length === 1) {
      if (expiry_date === "Not detected") expiry_date = foundDates[0];
    }
  }

  // --- Keyword+date line-by-line fallback ---
  // Search combinedText line by line for date-like patterns near MFG/EXP keywords
  if (expiry_date === "Not detected" || manufacturing_date === "Not detected") {
    const keywordDatePattern =
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-]\d{1,2}|[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3}[\/\-\s]\d{2,4})/;
    const mfgKeywords =
      /\b(MFG|MFD|MFGD|DOM|MANUFACTURED|DATE\s+OF\s+MFG|MFD\s+ON|MANUFACTURING)\b/i;
    const expKeywords =
      /\b(EXP|EXPIRY|EXPIRATION|USE\s+BEFORE|USE\s+BY|BEST\s+BEFORE|VALID\s+UPTO|VALID\s+TILL|BEFORE)\b/i;
    for (const line of combinedText.split("\n")) {
      const l = line.trim();
      if (!l) continue;
      const dateMatch = l.match(keywordDatePattern);
      if (!dateMatch) continue;
      const candidate = dateMatch[1].trim();
      const parsed = parseDate(candidate);
      if (!parsed) continue;
      const yr = parsed.getFullYear();
      if (yr < 2000 || yr > 2040) continue;
      if (manufacturing_date === "Not detected" && mfgKeywords.test(l)) {
        manufacturing_date = candidate;
      }
      if (expiry_date === "Not detected" && expKeywords.test(l)) {
        expiry_date = candidate;
      }
    }
  }

  // --- Medicine name ---
  // Use first 15 lines of combinedText (brand names appear near the top of the strip)
  let medicine_name = "Not detected";
  const skipPrefixes =
    /^(MFG|MFD|EXP|BATCH|LOT|B\.NO|B\.N|B NO|MRP|NET|WT|TAB|CAP|INJ|SYRUP|CONTAINS|EACH|STORE|KEEP|DESCRIPTION|MANUFACTURED|MARKETED|FOR|USE|DO\s+NOT|WWW|HTTP|©|CIN|DRUG|REG|LIC|DL|COMPOSITION|INGREDIENTS|DOSAGE|WARNING|CAUTION|SCHEDULE|STRIP|MFGDT|MFDT|\d)/i;
  // Relaxed skipIfContains: removed tablet/capsule/injection/syrup so names like "CROCIN TABLETS" are kept
  const skipIfContains =
    /(\d{2}[\/\-]\d{2,4}|www\.|\..com|batch|lot no|b\.no|\brs\b|\bmrp\b|phone|mob|tel:|fax|pvt\.?\s*ltd|pvt ltd|private limited|pharmaceuticals|laboratories|lab\.|pharma ltd|healthcare ltd|industries|village|taluka|nagar|road|street|plot|survey|gujarat|maharashtra|rajasthan|karnataka|hyderabad|mumbai|chennai|delhi|kolkata|bengaluru|ahmedabad|pune|pin code|\bpin\b|hydrochloride|hydrochlorid|sulphate|sulfate|phosphate|maleate|tartrate|citrate|acetate|gluconate|chloride|bromide|mesylate|fumarate|succinate|sodium|potassium|calcium|magnesium|\bsolution\b|\bsuspension\b|\bgel\b|\bcream\b|\bointment\b|\bpowder\b|\%)/i;

  // Search first 20 lines of primaryNorm for brand name using scoring
  const topLines = primaryNorm
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 20);

  // Also gather from combined (all unique non-empty lines)
  const allCandidateLines = Array.from(
    new Set(
      combinedText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    ),
  );

  interface ScoredLine {
    line: string;
    score: number;
  }

  function scoreLine(
    line: string,
    positionIndex: number,
    _totalLines: number,
  ): ScoredLine | null {
    if (line.length < 3 || line.length > 60) return null;
    if (skipPrefixes.test(line)) return null;
    if (skipIfContains.test(line)) return null;
    // Must have at least 3 consecutive alpha chars
    if (!/[A-Za-z]{3,}/.test(line)) return null;
    // Skip purely numeric lines
    if (/^[\d\s\.\/\-\(\)]+$/.test(line)) return null;
    // Skip lines with only long words (likely chemical names like Hydrochloride)
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length <= 3 && words.every((w) => w.length > 12)) return null;
    // Must contain at least one letter
    if (!/[A-Za-z]/.test(line)) return null;

    let score = 0;
    // Position score: higher for top lines
    score += Math.max(0, 20 - positionIndex * 2);
    // All-caps brand name bonus
    if (/^[A-Z][A-Z0-9®™\s\-\+\(\)\.]{2,39}$/.test(line)) score += 30;
    // Ideal brand name length 4-25 chars
    if (line.length >= 4 && line.length <= 25) score += 20;
    else if (line.length <= 40) score += 10;
    // Short word count (1-3 words) preferred for brand names
    if (words.length >= 1 && words.length <= 3) score += 15;
    // No digits in line
    if (!/\d/.test(line)) score += 10;
    // Starts with uppercase
    if (/^[A-Z]/.test(line)) score += 5;
    // Mixed case title-style (like "Crocin")
    if (/^[A-Z][a-z]/.test(line)) score += 8;

    return { line, score };
  }

  // Score top lines (primary scan order)
  const scoredTop: ScoredLine[] = [];
  for (let i = 0; i < topLines.length; i++) {
    const scored = scoreLine(topLines[i], i, topLines.length);
    if (scored) scoredTop.push(scored);
  }

  if (scoredTop.length > 0) {
    scoredTop.sort((a, b) => b.score - a.score);
    medicine_name = scoredTop[0].line;
  }

  // If still not found, try all candidate lines with position = 10 (no top bonus)
  if (medicine_name === "Not detected") {
    const scoredAll: ScoredLine[] = [];
    for (let i = 0; i < allCandidateLines.length; i++) {
      const scored = scoreLine(
        allCandidateLines[i],
        10,
        allCandidateLines.length,
      );
      if (scored) scoredAll.push(scored);
    }
    if (scoredAll.length > 0) {
      scoredAll.sort((a, b) => b.score - a.score);
      medicine_name = scoredAll[0].line;
    }
  }

  // Length floor: discard noise
  if (medicine_name.length < 3) medicine_name = "Not detected";

  console.log("[HealthDoor] Extracted:", {
    medicine_name,
    manufacturing_date,
    expiry_date,
  });

  return {
    medicine_name,
    manufacturing_date,
    expiry_date,
    rawOcrText: combinedText,
  };
}

function getExpiryStatus(expiryDate: string): "valid" | "expired" | "unknown" {
  if (!expiryDate || expiryDate === "Not detected") return "unknown";
  let parsedDate: Date | null = null;

  const mmYYYY = expiryDate.match(/(\d{2})\/(\d{4})/);
  const mmYY = expiryDate.match(/(\d{2})\/(\d{2})$/);
  const monYYYY = expiryDate.match(/([A-Za-z]{3,9})\s*(\d{4})/);
  const ddMMYYYY = expiryDate.match(
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
  );

  if (ddMMYYYY) {
    parsedDate = new Date(
      Number.parseInt(ddMMYYYY[3]),
      Number.parseInt(ddMMYYYY[2]) - 1,
      Number.parseInt(ddMMYYYY[1]),
    );
  } else if (mmYYYY) {
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

async function compressImage(file: File, maxSizeKB = 900): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxDim = 1800;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.9;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
              resolve(blob);
            } else {
              quality -= 0.15;
              tryCompress();
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

async function preprocessImageForOCR(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Target width: 2000px max, at least 1200px for readability
      const targetW = Math.min(2000, Math.max(1200, img.width));
      const scale = targetW / img.width;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      // Convert to grayscale + boost contrast
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(
          0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2],
        );
        // Boost contrast: stretch histogram
        const contrasted = Math.min(
          255,
          Math.max(0, Math.round((gray - 128) * 1.4 + 128)),
        );
        d[i] = d[i + 1] = d[i + 2] = contrasted;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// ------- Voice helper (multi-language) -------
function speakResult(
  result: ScanResult,
  lang = "en-US",
): SpeechSynthesisUtterance | null {
  if (!window.speechSynthesis) return null;
  const tpl = LANG_TEMPLATES[lang] || LANG_TEMPLATES["en-US"];
  const status = getExpiryStatus(result.expiry_date);
  const statusText =
    status === "valid"
      ? tpl.valid
      : status === "expired"
        ? tpl.expired
        : tpl.unknown;
  const mfg = formatDateDisplay(result.manufacturing_date) || tpl.unknown;
  const exp = formatDateDisplay(result.expiry_date) || tpl.unknown;
  const name = result.medicine_name || tpl.unknown;
  const howToUseText = result.how_to_use
    ? ` How to use: ${result.how_to_use}`
    : "";
  const text = `${tpl.medicine}: ${name}. ${tpl.mfg}: ${mfg}. ${tpl.exp}: ${exp}. ${tpl.status}: ${statusText}.${howToUseText}`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return utterance;
}

async function fetchHowToUse(medicineName: string): Promise<string> {
  if (!medicineName || medicineName === "Not detected") return "";
  try {
    const encoded = encodeURIComponent(medicineName);
    let url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"&limit=1`;
    let resp = await fetch(url);
    if (!resp.ok) {
      url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encoded}"&limit=1`;
      resp = await fetch(url);
    }
    if (!resp.ok) return "";
    const data = await resp.json();
    const result = data?.results?.[0];
    if (!result) return "";
    const dosage =
      result.dosage_and_administration?.[0] ||
      result.indications_and_usage?.[0] ||
      "";
    return dosage.slice(0, 500) + (dosage.length > 500 ? "..." : "");
  } catch {
    return "";
  }
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
function ResultCard({
  result,
  autoSpeak,
  voiceLang,
}: {
  result: ScanResult;
  autoSpeak?: boolean;
  voiceLang?: string;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const status = getExpiryStatus(result.expiry_date);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasSpeechSupport =
    typeof window !== "undefined" && !!window.speechSynthesis;

  const resultRef = useRef(result);
  const autoSpeakRef = useRef(autoSpeak);
  const langRef = useRef(voiceLang || "en-US");

  // sync lang ref
  useEffect(() => {
    langRef.current = voiceLang || "en-US";
  }, [voiceLang]);

  // Auto-speak once when the card first mounts
  useEffect(() => {
    if (!autoSpeakRef.current || !window.speechSynthesis) return;
    const utterance = speakResult(resultRef.current, langRef.current);
    if (utterance) {
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
    }
  }, []);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const handleVoice = () => {
    if (!hasSpeechSupport) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = speakResult(result, langRef.current);
    if (utterance) {
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {hasSpeechSupport && (
            <button
              type="button"
              data-ocid="result.toggle"
              onClick={handleVoice}
              title={isSpeaking ? "Stop listening" : "Listen to result"}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isSpeaking
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {isSpeaking ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
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
            {formatDateDisplay(result.manufacturing_date) || "Not detected"}
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
            {formatDateDisplay(result.expiry_date) || "Not detected"}
          </p>
        </div>
      </div>
      {result.how_to_use && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How to Use
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {result.how_to_use}
          </p>
        </div>
      )}
      {result.rawOcrText && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Eye className="w-3 h-3" />
            {showRaw ? "Hide raw OCR text" : "Show raw OCR text"}
          </button>
          {showRaw && (
            <pre className="mt-2 text-xs font-mono bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">
              {result.rawOcrText}
            </pre>
          )}
        </div>
      )}
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
          EXP: {formatDateDisplay(item.result.expiry_date) || "N/A"}
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

// ------- Language Selector -------
function LanguageSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (lang: string) => void;
}) {
  const selected = LANGUAGES.find((l) => l.code === value) || LANGUAGES[0];
  return (
    <div className="flex items-center gap-1">
      <span className="text-base">{selected.flag}</span>
      <select
        data-ocid="voice.select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-medium bg-transparent border border-border rounded-md px-1.5 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50 transition-colors"
        title="Select language for voice"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ------- Main App -------
export default function App() {
  const { identity } = useInternetIdentity();
  const { actor } = useActor();
  const isLoggedIn = !!identity && !identity.getPrincipal().isAnonymous();

  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [loadingBackendHistory, setLoadingBackendHistory] = useState(false);

  // Voice state
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const handleAnalyzeRef = useRef<() => void>(() => {});

  // Keep selectedFileRef in sync
  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

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
      .catch(() => {})
      .finally(() => setLoadingBackendHistory(false));
  }, [isLoggedIn, actor]);

  useEffect(() => {
    if (!isLoggedIn) {
      setHistory(loadHistory());
    }
  }, [isLoggedIn]);

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
      setAutoSpeak(false);
      setErrorMsg(null);
      setVoiceTranscript("");
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
    setAnalyzing(true);
    setErrorMsg(null);
    setResult(null);
    setAutoSpeak(false);

    try {
      // Preprocess image: grayscale + contrast boost, then compress
      const preprocessed = await preprocessImageForOCR(selectedFile);
      const compressedBlob = await compressImage(
        new File([preprocessed], selectedFile.name, { type: "image/jpeg" }),
      );
      const compressedFile = new File([compressedBlob], selectedFile.name, {
        type: "image/jpeg",
      });

      // OCR pass helper
      async function runOcr(engine: string): Promise<string> {
        const fd = new FormData();
        fd.append("apikey", "helloworld");
        fd.append("file", compressedFile);
        fd.append("language", "eng");
        fd.append("isOverlayRequired", "false");
        fd.append("OCREngine", engine);
        fd.append("scale", "true");
        fd.append("isTable", "false");
        fd.append("detectOrientation", "true");
        try {
          const resp = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            body: fd,
          });
          if (!resp.ok) return "";
          const data = await resp.json();
          if (data.IsErroredOnOcr || !data.ParsedResults?.length) return "";
          return data.ParsedResults.map((r: any) => r.ParsedText || "").join(
            "\n",
          );
        } catch {
          return "";
        }
      }

      // Run Engine 2 (better for printed text), then Engine 1 as fallback
      const text2 = await runOcr("2");
      const text1 = await runOcr("1");
      console.log("[HealthDoor] OCR Engine2:", text2);
      console.log("[HealthDoor] OCR Engine1:", text1);

      const combinedOcr = [text2, text1].filter(Boolean).join("\n");

      if (!combinedOcr || combinedOcr.trim().length < 5) {
        throw new Error(
          "Could not read text from image. Please use a clearer, well-lit photo where the text on the strip is sharp.",
        );
      }

      const res = extractMedicineData(combinedOcr, combinedOcr);
      const howToUse = await fetchHowToUse(res.medicine_name);
      const resWithUsage: ScanResult = { ...res, how_to_use: howToUse };
      setResult(resWithUsage);
      setAutoSpeak(true);

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        result: resWithUsage,
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
          .catch(() => {});
      } else {
        saveHistory(newHistory);
      }

      toast.success("Analysis complete!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [selectedFile, actor, previewUrl, history, isLoggedIn]);

  // Keep handleAnalyzeRef in sync for use inside recognition callback
  useEffect(() => {
    handleAnalyzeRef.current = handleAnalyze;
  }, [handleAnalyze]);

  // Voice commands (STT trigger words per language)
  const triggerWords: Record<string, string[]> = {
    "en-US": ["scan", "analyze", "check", "read"],
    "hi-IN": ["स्कैन", "जांच", "पढ़ो"],
    "es-ES": ["escanear", "analizar", "verificar"],
    "fr-FR": ["scanner", "analyser", "vérifier"],
    "ar-SA": ["مسح", "تحليل", "فحص"],
    "zh-CN": ["扫描", "分析", "检查"],
    "de-DE": ["scannen", "analysieren", "prüfen"],
    "pt-BR": ["escanear", "analisar", "verificar"],
    "ru-RU": ["сканировать", "анализировать", "проверить"],
    "ja-JP": ["スキャン", "分析", "確認"],
    "ta-IN": ["ஸ்கேன்", "பகுப்பாய்வு", "சரிபார்"],
    "ur-PK": ["اسکین", "تجزیہ", "جانچ"],
    "te-IN": ["స్కాన్", "విశ్లేషించు", "తనిఖీ"],
  };

  const startListening = useCallback(() => {
    if (!hasSpeechRecognition) return;
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      // Check for voice commands
      const words = triggerWords[voiceLang] || triggerWords["en-US"];
      const lower = transcript.toLowerCase();
      const isCommand = words.some((w) => lower.includes(w.toLowerCase()));
      if (isCommand && selectedFileRef.current) {
        handleAnalyzeRef.current();
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [hasSpeechRecognition, voiceLang]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

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
            <img
              src="/assets/uploads/app_logo-019d385e-4c6a-772e-8e2c-5476cd4d4335-1.png"
              alt="Health Door Logo"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <span className="text-lg font-bold text-foreground tracking-tight">
              Health Door
            </span>
          </div>
          {/* Right actions */}
          <div className="flex items-center gap-2">
            <LanguageSelector value={voiceLang} onChange={setVoiceLang} />
            <AuthButton />
          </div>
        </div>
      </header>

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
                  Know What You&apos;re
                  <span className="text-primary"> Taking.</span>
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  Upload a photo of any medicine strip. It instantly extracts
                  the medicine name, manufacturing date, and expiry status — all
                  processed locally on your device, no account needed.
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
                    <CheckCircle2 className="w-4 h-4 text-success" /> 100%
                    Private
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
                        EXP: March 2026
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
                Drag a photo or use your camera — OCR reads the strip labels
                directly on your device, no cloud, no API keys.
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
                          setVoiceTranscript("");
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
                      <div className="flex items-center gap-3 flex-wrap justify-center">
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
                        {hasSpeechRecognition && (
                          <button
                            type="button"
                            data-ocid="voice.upload_button"
                            onClick={
                              isListening ? stopListening : startListening
                            }
                            title={
                              isListening
                                ? "Stop listening"
                                : "Speak a command (e.g. 'scan')"
                            }
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                              isListening
                                ? "bg-destructive text-destructive-foreground animate-pulse"
                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            {isListening ? (
                              <MicOff className="w-4 h-4" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                            {isListening ? "Listening..." : "Voice"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Voice transcript display */}
              <AnimatePresence>
                {(isListening || voiceTranscript) && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 flex items-start gap-2 bg-muted/60 rounded-lg px-3 py-2"
                  >
                    <Mic
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        isListening
                          ? "text-destructive animate-pulse"
                          : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isListening && !voiceTranscript
                        ? 'Listening… say a command like "scan"'
                        : voiceTranscript || ""}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

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
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Reading medicine strip...
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
                      Analyzing medicine strip...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Processing image on your device — first scan loads OCR
                      engine (~10MB, cached after)
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
                        {String(errorMsg ?? "")}
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
                <ResultCard
                  result={result}
                  autoSpeak={autoSpeak}
                  voiceLang={voiceLang}
                />
                <div className="mt-8 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 flex flex-col items-center gap-3 text-center">
                  <p className="text-base font-semibold text-foreground">
                    Want to scan another medicine?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tap the button below to start a new scan
                  </p>
                  <Button
                    data-ocid="scan.new_scan_button"
                    onClick={() => {
                      setResult(null);
                      setSelectedFile(null);
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      setErrorMsg(null);
                      uploadSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                      });
                    }}
                    className="gap-2 px-8 mt-1"
                    size="lg"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Scan Another Medicine
                  </Button>
                </div>
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
                Three simple steps to verify your medicine&apos;s safety in
                seconds.
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
                  title: "Smart OCR Analysis",
                  desc: "Advanced text recognition reads the strip labels directly in your browser — no cloud, no API keys, completely private.",
                },
                {
                  icon: <ShieldCheck className="w-6 h-6 text-primary" />,
                  step: "03",
                  title: "Review Results",
                  desc: "Instantly see if your medicine is valid or expired, with clearly structured extracted data — and hear it spoken aloud in your language.",
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
    </div>
  );
}
