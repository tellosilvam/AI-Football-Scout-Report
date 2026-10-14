/**
 * One icon per concept, used everywhere that concept appears.
 * Lucide (MIT) stroke icons: they inherit `currentColor` and render as inline SVG,
 * statically in .astro files and inside React islands alike.
 */
import {
  ArrowLeftRight,
  Calculator,
  ChartColumn,
  ChartPie,
  CirclePlay,
  Clock,
  ClipboardList,
  Crosshair,
  Database,
  FileText,
  Flame,
  Goal,
  Hand,
  Handshake,
  ListChecks,
  MessageCircle,
  Repeat,
  Search,
  Shield,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Target,
  Timer,
  Binoculars,
  Users,
  Wand2,
  Wrench,
  Zap,
  Filter,
  type LucideIcon,
} from 'lucide-react';

/** Metric categories (match `Category` in lib/football/metrics.ts). */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  attack: Crosshair,
  creation: Wand2,
  possession: Repeat,
  defense: Shield,
  goalkeeping: Hand,
};

/** Dossier sections (ids used as anchors). */
export const SECTION_ICON: Record<string, LucideIcon> = {
  percentiles: ChartPie,
  report: FileText,
  fit: Target,
  similar: Users,
  ask: MessageCircle,
};

/** Season facts row. */
export const FACT_ICON = {
  minutes: Clock,
  apps: Shirt,
  starts: CirclePlay,
  goals: Goal,
  assists: Handshake,
  rating: Star,
} satisfies Record<string, LucideIcon>;

export const PERSONA_ICON: Record<string, LucideIcon> = {
  analyst: ChartColumn,
  veteran: Binoculars,
  coach: ClipboardList,
};

export const STYLE_ICON: Record<string, LucideIcon> = {
  possession: Repeat,
  'high-press': Flame,
  'low-block': Shield,
  transition: Zap,
};

/** Chat tools, by tool name. */
export const TOOL_ICON: Record<string, LucideIcon> = {
  getPlayerStats: ChartColumn,
  searchPlayers: Search,
  comparePlayers: ArrowLeftRight,
  findSimilar: Users,
  discoverPlayers: Filter,
};

/** Landing "how it works" steps, in order. */
export const STEP_ICONS: LucideIcon[] = [Database, Calculator, ListChecks, ShieldCheck];

/** Landing evals block, in order: verified, first try, time, tools. */
export const PROOF_ICONS: LucideIcon[] = [ShieldCheck, Zap, Timer, Wrench];

export const DISCOVER_ICON = Sparkles;
