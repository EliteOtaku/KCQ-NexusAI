/* 临时 spike，验证 upstream #283：本文件自我方闭源资产 kcq-plugins 原样复制，仅做上游兼容性适配（改动见各处 spike 标注），勿当生产代码。 */

/** 一目均衡表套件：配置与参数解析层（零运行时依赖，localStorage 持久化）。
 *
 *  参数语义权威 = D:\AI\Ichimoku-MTF\pine\IchimokuMTF_cn.pine ① 核心参数段：
 *  三值同源铁律——kijun 同时决定 基准线周期 / 位移基本数 / 云层偏移数
 *  （Pine dispIn = kijunLen，独立输入位已移除），本层 disp 一律派生，禁止独立输入。
 *  计数模式：原著修正（含当日计数 → disp = kijun − 1，与 TradingView 内置一致）
 *  / 经典软件（不含当日 → disp = kijun，与 MT4/MT5 内置一致）。
 *
 *  持久化（两个 localStorage 键，键名不含版本号，版本在值内）：
 *  - 'kcq_ichimoku_cfg'  存 IchimokuCfg（低频、需迁移：schema 校验 + 迁移函数表
 *    逐级升级；损坏/未来版本 → 原值备份到 'kcq_ichimoku_cfg_bak_<Date.now()>'
 *    后返回 defaultCfg()，绝不静默丢用户配置）
 *  - 'kcq_ichimoku_ui'   存面板 UI 状态（高频、无迁移：位置/折叠态/激活区）
 *  save 侧写入前逐字段净化（参数数字 clamp 到 [1,999] 整数、枚举白名单），
 *  脏值丢弃；localStorage 全程 try/catch（隐私模式兜底）。
 */

/** 周期键 = 宿主 KLinePeriod 字面量（11 档，禁止自造别名；fork
 *  packages/core/src/data/provider/types.ts KLinePeriod 同名直传 connector） */
export type KlinePeriodKey =
  | "1min"
  | "5min"
  | "15min"
  | "30min"
  | "60min"
  | "4h"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

/** 全部周期键（白名单净化/遍历用） */
export const KLINE_PERIOD_KEYS: readonly KlinePeriodKey[] = [
  "1min",
  "5min",
  "15min",
  "30min",
  "60min",
  "4h",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

/** 单周期参数（disp 一律派生，禁止独立输入——Pine 三值同源铁律） */
export interface IchimokuParams {
  tenkan: number;
  kijun: number;
  senkouB: number;
}

/** 计数模式：original（原著修正，默认）/ classic（经典软件） */
export type CountMode = "original" | "classic";

/** 位移基本数（Pine L99：disp = countMode == MODE_ORIG ? dispIn - 1 : dispIn）
 *  original：含当日计数 → disp = kijun − 1；classic：不含当日 → disp = kijun */
export function dispOf(p: IchimokuParams, mode: CountMode): number {
  return mode === "original" ? p.kijun - 1 : p.kijun;
}

/** 市场体制：'5x24' 传统（有休市）/ '7x24' 连续（加密/贵金属 CFD） */
export type MarketRegime = "5x24" | "7x24";

/** 档级（flash 顾问定稿）：日内/日线/周月/季年 四档；体制只影响日线档 */
export type ParamTier = "intraday" | "daily" | "weeklyMonthly" | "quarterYearly";

/** 周期 → 档级映射：1min..60min+4h→intraday；daily→daily；
 *  weekly/monthly→weeklyMonthly；quarterly/yearly→quarterYearly */
export function tierOf(period: KlinePeriodKey): ParamTier {
  switch (period) {
    case "1min":
    case "5min":
    case "15min":
    case "30min":
    case "60min":
    case "4h":
      return "intraday";
    case "daily":
      return "daily";
    case "weekly":
    case "monthly":
      return "weeklyMonthly";
    case "quarterly":
    case "yearly":
      return "quarterYearly";
  }
}

/** 档级默认参数表（体制相关）：intraday 9/26/52；daily 5x24→7/22/44、
 *  7x24→10/30/60；weeklyMonthly 9/26/52；quarterYearly 9/26/52（继承月档）。
 *  返回新对象（调用方可自由改写，不污染内置表）。 */
export function defaultParams(tier: ParamTier, regime: MarketRegime): IchimokuParams {
  if (tier === "daily" && regime === "5x24") return { tenkan: 7, kijun: 22, senkouB: 44 };
  if (tier === "daily") return { tenkan: 10, kijun: 30, senkouB: 60 };
  // intraday / weeklyMonthly / quarterYearly 共用原著 9/26/52
  return { tenkan: 9, kijun: 26, senkouB: 52 };
}

/** HTF 右侧切片单槽配置（Pine ⑫ 槽1-5：on/tf/根数 三元组） */
export interface IchimokuSliceSlotCfg {
  on: boolean;
  tf: KlinePeriodKey;
  /** 切片视窗根数，白名单 [3,20]（Pine sl1N minval=3 maxval=20） */
  n: number;
}

/** HTF 右侧切片与延迟段（Pine ⑫ 组；默认值烧录自 Pine input 缺省） */
export interface IchimokuSlicesCfg {
  /** 切片总开关（Pine slOn） */
  on: boolean;
  /** 5 槽（Pine 默认 1h/4h/D/W/M × 10/10/10/6/4，全启用） */
  slots: IchimokuSliceSlotCfg[];
  /** 组间隔（图表 K 线根数，[0,100]，Pine slGap 缺省 12） */
  gap: number;
  /** 未来云+（[0,10]，Pine slFut 缺省 3） */
  fut: number;
  /** 切片价签（Pine slTag 缺省 true） */
  tags: boolean;
  /** 剩余时间标签（Pine slTime 缺省 true） */
  timeLeft: boolean;
  /** 延迟线左绘（Pine slChiL 缺省 true） */
  chikouLeft: boolean;
  /** 延迟线根数（[5,50]，Pine slChiN 缺省 20） */
  chiN: number;
  /** 延迟窗 ghost（Pine slGhostOn 缺省 true） */
  ghost: boolean;
  /** ghost ±根（[0,5]，Pine slGhostPad 缺省 2） */
  ghostPad: number;
  /** 收线标签（Pine slGhostCl 缺省 false） */
  closeLabel: boolean;
}

/** 用户配置（持久化 diff 语义：只存与内置默认的差异；perPeriod 空对象=全跟随默认） */
export interface IchimokuCfg {
  /** 存储结构版本，当前 = 1 */
  schema: number;
  countMode: CountMode;
  /** 'auto' = 运行时按品种判定体制；否则强制指定 */
  regimeOverride: "auto" | MarketRegime;
  /** 档级覆盖（diff：只写与 defaultParams 不同的字段） */
  tierParams: Partial<Record<ParamTier, Partial<IchimokuParams>>>;
  /** 逐周期覆盖（diff，优先级最高） */
  perPeriod: Partial<Record<KlinePeriodKey, Partial<IchimokuParams>>>;
  /** 显示开关（全 true，paintBars 默认 false；lineWidth=三主线线宽 [1,5] 缺省 2，
   *  Pine wMain 同源——转折/基准/延迟三线共用） */
  display: {
    tenkan: boolean;
    kijun: boolean;
    chikou: boolean;
    kumo: boolean;
    paintBars: boolean;
    lineWidth: number;
  };
  /** ⑫ 右侧切片与延迟段（Pine 缺省值烧录） */
  slices: IchimokuSlicesCfg;
}

/** 当前存储结构版本 */
export const ICHIMOKU_CFG_SCHEMA = 1;

/** 切片默认槽表（Pine ⑫ 槽1-5 input 缺省烧录：1h/4h/D/W/M × 10/10/10/6/4 全启用） */
export function defaultSlices(): IchimokuSlicesCfg {
  return {
    on: true,
    slots: [
      { on: true, tf: "60min", n: 10 },
      { on: true, tf: "4h", n: 10 },
      { on: true, tf: "daily", n: 10 },
      { on: true, tf: "weekly", n: 6 },
      { on: true, tf: "monthly", n: 4 },
    ],
    gap: 12,
    fut: 3,
    tags: true,
    timeLeft: true,
    chikouLeft: true,
    chiN: 20,
    ghost: true,
    ghostPad: 2,
    closeLabel: false,
  };
}

/** 构造全新默认配置（每次返回新对象） */
export function defaultCfg(): IchimokuCfg {
  return {
    schema: ICHIMOKU_CFG_SCHEMA,
    countMode: "original",
    regimeOverride: "auto",
    tierParams: {},
    perPeriod: {},
    display: {
      tenkan: true,
      kijun: true,
      chikou: true,
      kumo: true,
      paintBars: false,
      lineWidth: 2,
    },
    slices: defaultSlices(),
  };
}

/** 解析后的完整参数快照（含派生 disp） */
export interface ResolvedParams extends IchimokuParams {
  disp: number;
}

/** 解析优先级：perPeriod[period] > tierParams[tier] > defaultParams(tier, regime)。
 *  逐字段合并（Partial 里出现的字段才覆盖）；体制先经 cfg.regimeOverride
 *  裁决（'auto' 用传入 regime）；disp 按 cfg.countMode 从合并后的 kijun 派生。 */
export function resolveParams(
  period: KlinePeriodKey,
  cfg: IchimokuCfg,
  regime: MarketRegime,
): ResolvedParams {
  const effRegime: MarketRegime = cfg.regimeOverride === "auto" ? regime : cfg.regimeOverride;
  const tier = tierOf(period);
  const base = defaultParams(tier, effRegime);
  const tierDiff = cfg.tierParams[tier];
  const perDiff = cfg.perPeriod[period];
  const merged: IchimokuParams = {
    tenkan: perDiff?.tenkan ?? tierDiff?.tenkan ?? base.tenkan,
    kijun: perDiff?.kijun ?? tierDiff?.kijun ?? base.kijun,
    senkouB: perDiff?.senkouB ?? tierDiff?.senkouB ?? base.senkouB,
  };
  return { ...merged, disp: dispOf(merged, cfg.countMode) };
}

// ───────────────────────────── 持久化：cfg ─────────────────────────────

const CFG_KEY = "kcq_ichimoku_cfg";
const CFG_BAK_PREFIX = "kcq_ichimoku_cfg_bak_";

/** 迁移函数表：键 = 源 schema 版本，值 = 升到下一版的纯变换。
 *  只追加不回改（v1 为初版，暂无条目）；load 时从读到的版本逐级升到当前版。 */
const CFG_MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2 示例占位（真加版本时替换）：(raw) => ({ ...raw, newField: 默认值, schema: 2 })
};

/** 参数字段白名单（净化遍历用） */
const PARAM_FIELDS = ["tenkan", "kijun", "senkouB"] as const;

/** 参数数字净化：强制有限数 + clamp 到 [1,999] 整数；脏值返回 undefined */
function clampParam(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.min(999, Math.max(1, Math.round(v)));
}

/** 区间整数净化：强制有限数 + clamp 到 [lo,hi] 整数；脏值返回 undefined */
function clampIntRange(v: unknown, lo: number, hi: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Partial<IchimokuParams> 净化：只收白名单字段，clamp 后为空则丢整个条目 */
function sanitizeParamsDiff(raw: unknown): Partial<IchimokuParams> | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;
  const out: Partial<IchimokuParams> = {};
  for (const f of PARAM_FIELDS) {
    const v = clampParam(src[f]);
    if (v !== undefined) out[f] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 枚举白名单净化 */
function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** 布尔净化：非布尔丢脏值用默认 */
function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** 区间整数取值：脏值回退缺省（切片标量字段用，缺省必在白名单区间内） */
function pickInt(v: unknown, lo: number, hi: number, dflt: number): number {
  return clampIntRange(v, lo, hi) ?? dflt;
}

/** 切片槽白名单净化：固定补齐 5 槽（槽位序号=缺省 tf/n 回退依据），脏字段逐个丢弃 */
function sanitizeSlices(raw: unknown): IchimokuSlicesCfg {
  const dflt = defaultSlices();
  if (raw == null || typeof raw !== "object") return dflt;
  const src = raw as Record<string, unknown>;
  const slots: IchimokuSliceSlotCfg[] = dflt.slots.map((d, i) => {
    const s = Array.isArray(src.slots) ? (src.slots[i] as Record<string, unknown> | undefined) : undefined;
    if (s == null || typeof s !== "object") return { ...d };
    return {
      on: pickBool(s.on, d.on),
      tf: pickEnum(s.tf, KLINE_PERIOD_KEYS, d.tf),
      n: pickInt(s.n, 3, 20, d.n),
    };
  });
  return {
    on: pickBool(src.on, dflt.on),
    slots,
    gap: pickInt(src.gap, 0, 100, dflt.gap),
    fut: pickInt(src.fut, 0, 10, dflt.fut),
    tags: pickBool(src.tags, dflt.tags),
    timeLeft: pickBool(src.timeLeft, dflt.timeLeft),
    chikouLeft: pickBool(src.chikouLeft, dflt.chikouLeft),
    chiN: pickInt(src.chiN, 5, 50, dflt.chiN),
    ghost: pickBool(src.ghost, dflt.ghost),
    ghostPad: pickInt(src.ghostPad, 0, 5, dflt.ghostPad),
    closeLabel: pickBool(src.closeLabel, dflt.closeLabel),
  };
}

/** 把任意 JSON 原值净化成合法 IchimokuCfg；结构不可救（非对象/schema 非法）
 *  返回 null（调用方走备份 + defaultCfg 路径），可救字段逐个取值，脏值丢弃 */
function sanitizeCfg(raw: unknown): IchimokuCfg | null {
  if (raw == null || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.schema !== "number" || !Number.isInteger(src.schema) || src.schema < 1) return null;

  // schema 迁移：从读到的版本逐级升级到当前版（迁移表缺级视为损坏）
  let upgraded = src;
  let v = src.schema;
  while (v < ICHIMOKU_CFG_SCHEMA) {
    const step = CFG_MIGRATIONS[v];
    if (!step) return null;
    upgraded = step(upgraded);
    if (upgraded == null || typeof upgraded !== "object") return null;
    v = typeof (upgraded as Record<string, unknown>).schema === "number"
      ? ((upgraded as Record<string, unknown>).schema as number)
      : v + 1;
  }
  if (v !== ICHIMOKU_CFG_SCHEMA) return null; // 未来版本 → 走备份

  const tierParams: IchimokuCfg["tierParams"] = {};
  const rawTier = src.tierParams;
  if (rawTier != null && typeof rawTier === "object") {
    for (const [tier, diff] of Object.entries(rawTier as Record<string, unknown>)) {
      const s = sanitizeParamsDiff(diff);
      if (s) tierParams[tier as ParamTier] = s;
    }
  }
  const perPeriod: IchimokuCfg["perPeriod"] = {};
  const rawPer = src.perPeriod;
  if (rawPer != null && typeof rawPer === "object") {
    for (const [period, diff] of Object.entries(rawPer as Record<string, unknown>)) {
      if (!(KLINE_PERIOD_KEYS as readonly string[]).includes(period)) continue; // 白名单外丢弃
      const s = sanitizeParamsDiff(diff);
      if (s) perPeriod[period as KlinePeriodKey] = s;
    }
  }
  const rawDisplay = (src.display ?? {}) as Record<string, unknown>;
  return {
    schema: ICHIMOKU_CFG_SCHEMA,
    countMode: pickEnum(src.countMode, ["original", "classic"] as const, "original"),
    regimeOverride: pickEnum(
      src.regimeOverride,
      ["auto", "5x24", "7x24"] as const,
      "auto",
    ),
    tierParams,
    perPeriod,
    display: {
      tenkan: pickBool(rawDisplay.tenkan, true),
      kijun: pickBool(rawDisplay.kijun, true),
      chikou: pickBool(rawDisplay.chikou, true),
      kumo: pickBool(rawDisplay.kumo, true),
      paintBars: pickBool(rawDisplay.paintBars, false),
      lineWidth: pickInt(rawDisplay.lineWidth, 1, 5, 2),
    },
    slices: sanitizeSlices(src.slices),
  };
}

/** 读入配置：localStorage 读 → JSON 解析 → schema 校验 → 迁移函数表逐级升级 →
 *  净化。任何一步不可救（损坏/未来版本）：原值备份到
 *  'kcq_ichimoku_cfg_bak_<Date.now()>' 后返回 defaultCfg()，绝不静默丢配置。 */
export function loadCfg(): IchimokuCfg {
  try {
    const text = localStorage.getItem(CFG_KEY);
    if (!text) return defaultCfg();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      backupCfg(text);
      return defaultCfg();
    }
    const cfg = sanitizeCfg(parsed);
    if (cfg) return cfg;
    backupCfg(text);
    return defaultCfg();
  } catch {
    return defaultCfg(); // localStorage 不可用（隐私模式）兜底
  }
}

/** 原值备份（带毫秒时间戳键，不覆盖历史备份）；备份失败静默（尽力而为） */
function backupCfg(rawText: string): void {
  try {
    localStorage.setItem(`${CFG_BAK_PREFIX}${Date.now()}`, rawText);
  } catch { /* 隐私模式/配额满：放弃备份，主流程继续 */ }
}

/** 写入配置：传参先经 sanitizeCfg 净化（数字 clamp [1,999] 整数、枚举白名单、
 *  脏值丢弃），再 JSON 序列化落盘；localStorage 异常静默吞掉。 */
export function saveCfg(cfg: IchimokuCfg): void {
  try {
    const clean = sanitizeCfg(cfg);
    if (!clean) return; // 结构不合法：拒绝写入（不污染存储）
    localStorage.setItem(CFG_KEY, JSON.stringify(clean));
  } catch { /* 隐私模式/配额满：静默 */ }
}

// ───────────────────────────── 持久化：面板 UI 状态 ─────────────────────────────

const UI_KEY = "kcq_ichimoku_ui";

/** 面板 UI 状态（本期简单：位置/折叠态/激活区；高频写入、无迁移语义）。
 *  collapsed：0 展开 / 1 折叠 / 2 激活区（语义归渲染层约定，本层只存取） */
export interface IchimokuUiState {
  /** 视口 px 坐标（左上角） */
  pos?: { left: number; top: number };
  collapsed?: 0 | 1 | 2;
}

/** 读入 UI 状态：损坏/异型 → 丢脏字段（返回残缺对象），localStorage 不可用 → {}。
 *  UI 状态无迁移（丢了大不了回默认位置），与 cfg 的备份语义刻意区分。 */
export function loadUi(): IchimokuUiState {
  try {
    const text = localStorage.getItem(UI_KEY);
    if (!text) return {};
    const raw = JSON.parse(text) as Record<string, unknown>;
    const out: IchimokuUiState = {};
    if (raw != null && typeof raw === "object") {
      const pos = raw.pos as Record<string, unknown> | undefined;
      if (
        pos != null &&
        typeof pos === "object" &&
        typeof pos.left === "number" && Number.isFinite(pos.left) &&
        typeof pos.top === "number" && Number.isFinite(pos.top)
      ) {
        out.pos = { left: pos.left, top: pos.top };
      }
      if (raw.collapsed === 0 || raw.collapsed === 1 || raw.collapsed === 2) {
        out.collapsed = raw.collapsed;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** 写入 UI 状态：有限数字/白名单外脏值丢弃后落盘；异常静默。 */
export function saveUi(ui: IchimokuUiState): void {
  try {
    const clean: IchimokuUiState = {};
    if (
      ui.pos &&
      Number.isFinite(ui.pos.left) &&
      Number.isFinite(ui.pos.top)
    ) {
      clean.pos = { left: ui.pos.left, top: ui.pos.top };
    }
    if (ui.collapsed === 0 || ui.collapsed === 1 || ui.collapsed === 2) {
      clean.collapsed = ui.collapsed;
    }
    localStorage.setItem(UI_KEY, JSON.stringify(clean));
  } catch { /* 隐私模式/配额满：静默 */ }
}
