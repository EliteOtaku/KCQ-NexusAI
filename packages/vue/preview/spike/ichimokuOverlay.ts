/* 临时 spike，验证 upstream #283：本文件自我方闭源资产 kcq-plugins 原样复制，仅做上游兼容性适配（改动见各处 spike 标注），勿当生产代码。 */

/** 一目均衡表主图 overlay（core 绘制插件，canvas 直绘 'main' pane）。
 *
 *  语义权威 = D:\AI\Ichimoku-MTF\pine\IchimokuMTF_cn.pine：
 *  - ② 显示（L103-122）：转折 #F23645 / 基准 #2962FF / 延迟 #FFFFFF（三主线共用
 *    wMain 线宽）；云边 A #FF9800 / B #636363（宽 2）、填充多头橙/空头灰；
 *    barcolor 收云上绿 #43A047 / 云下红 #F23645 / 云中灰。Pine color.new(c,t)
 *    的 t 是透明度（100=不可见）→ canvas alpha = (100−t)/100。
 *  - ⑫ 切片（L166-226 / L585-835）：f_slCandles 两段式影线零长段不画；
 *    f_slSlot 布局推进（起始空档 26 根、组间隔 cfg、总前瞻 ≤480 根放不下整槽跳过、
 *    未来云只用已确定值 raw senkouA/B[sz-1-(d-k)]）；f_slChikouLeft v2.22.1
 *    根数偏移（HTF 第 j 根收盘画到第 j−disp 根开盘时刻的图表 x，映射不到跳过）；
 *    f_slGhostBand v2.22 设计全宽窗 [sz-d-chiN-pad, sz-1-d+pad]，盒左右缘=
 *    该 HTF 根开盘时刻→下一根开盘时刻的 x。
 *  适配点（与 Pine 的差异）：
 *  1) 主图序列不用 security 拉流，draw 时从 core RenderContext.data 现场映射
 *     OhlcBar[]（KLineData 字段实名 timestamp/open/high/low/close，2026-09-30
 *     fork packages/core/src/foundation/types/price.ts 核实；分时 TimeShareData
 *     无 open 字段 → 非K线视图整体不画）；
 *  2) scene 组装 memoized 视口无关：数据签名 = n+首根t+末根t+period，
 *     参数签名 = JSON(resolvedParams+display)，均不变则跳过重算
 *     （禁止 JSON.stringify 整个 bars 数组）；
 *  3) 切片布局单位 = 图表 K 线根数（Pine bar_index 同构），未来区 x 按末根间距
 *     线性外推；历史锚定图元（ghost 盒/HTF延迟线/收线标签）用
 *     getLogicalIndexAtTimestamp 映射，映射不到的段跳过；
 *  4) 期权 overlay 先例（optionsOverlay.ts）draw 无异常防护是已知缺陷——本层
 *     paint 顶层 try/catch/finally：异常限频打 console 绝不回抛污染其他 renderer。
 */
import type { ChartSeriesDatum } from "@/foundation/types/price.js";
import type { RenderContext } from "@/foundation/plugin/types.js";
import { computeIchimoku, type IchimokuSeries, type OhlcBar } from "./ichimokuEngine";
import {
  KLINE_PERIOD_KEYS,
  resolveParams,
  type IchimokuCfg,
  type IchimokuSliceSlotCfg,
  type KlinePeriodKey,
  type MarketRegime,
  type ResolvedParams,
} from "./ichimokuParams";
import { IchimokuBarStore, nextCloseMs, periodSeconds } from "./ichimokuData";

// ───────────────────────────── 配色（Pine ② 显示 + ⑫ 切片烧录） ─────────────────────────────

const C_TENKAN = "#F23645";
const C_KIJUN = "#2962FF";
const C_CHIKOU = "#FFFFFF";
const C_CHIKOU_LIGHT = "#131722";
const C_SPAN_A = "#FF9800";
const C_SPAN_B = "#636363";
const C_BAR_BULL = "#43A047";
const C_BAR_BEAR = "#F23645";
const C_BAR_FLAT = "#787B86";
const C_SLICE_UP = "#089981";
const C_SLICE_DN = "#f23647";
const C_HTF_CHIKOU = "#5d6470";
const C_CLOSE_LBL = "#b2b5be";
const C_TF_TEXT = "#9AA0AA";

/** Pine transp（0 不透明..100 不可见）→ canvas alpha */
function pineAlpha(transp: number): number {
  return (100 - transp) / 100;
}

function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 价格标签加深（Pine L666-667：先行带色 RGB×0.72） */
function shade(hex: string, k: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

/** 周期 → TF 短名（Pine f_tfName L539-543 同口径） */
function tfName(p: KlinePeriodKey): string {
  switch (p) {
    case "1min": return "1m";
    case "5min": return "5m";
    case "15min": return "15m";
    case "30min": return "30m";
    case "60min": return "1h";
    case "4h": return "4h";
    case "daily": return "1D";
    case "weekly": return "1W";
    case "monthly": return "1M";
    case "quarterly": return "3M";
    case "yearly": return "12M";
  }
}

/** 裸价格文本（format.mintick 无 tick 元数据时的近似口径） */
function fmtPrice(v: number): string {
  const a = Math.abs(v);
  if (a >= 10000) return v.toFixed(1);
  if (a >= 100) return v.toFixed(2);
  if (a >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

function pad2(v: number): string {
  return v < 10 ? `0${v}` : String(v);
}

/** 剩余时间文本：≥1d 带 "Xd " 前缀（Pine L764-766），否则 HH:MM:SS / MM:SS */
function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}d ${pad2(h)}:${pad2(m)}:${pad2(sec)}`
    : s >= 3600 ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
    : `${pad2(m)}:${pad2(sec)}`;
}

// ───────────────────────────── 共享状态（工厂写入，overlay/面板只读） ─────────────────────────────

/** 插件共享状态：工厂（ichimoku.ts）持有并写入，overlay draw 消费；
 *  chartPeriod 由 overlay 每帧回写（工厂轮询/面板状态行的唯一图表周期来源） */
export interface IchimokuSharedState {
  cfg: IchimokuCfg;
  /** 生效体制（cfg.regimeOverride==='auto' 时由工厂按品种裁决） */
  regime: MarketRegime;
  /** 体制判定依据（面板口径区小字，如 `7×24（BTCUSD · assetClass=crypto）`） */
  regimeBasis: string;
  symbol: string | null;
  store: IchimokuBarStore;
  /** 宿主图表周期原始字符串（RenderDataContext.period；首次 draw 前 null） */
  chartPeriod: string | null;
  /** 宿主主题深色（Pine 配色按深色图烧录；浅色主题下延迟线换深色，缺省=true） */
  themeDark: boolean;
}

export function createIchimokuSharedState(
  init: Pick<IchimokuSharedState, "cfg" | "regime" | "regimeBasis" | "symbol" | "store">,
): IchimokuSharedState {
  return { ...init, chartPeriod: null, themeDark: true };
}

/** 宿主周期字符串 → KlinePeriodKey（11 档白名单；fork KLinePeriod 字面量同名直传） */
export function asKlinePeriodKey(p: string | null | undefined): KlinePeriodKey | null {
  return typeof p === "string" && (KLINE_PERIOD_KEYS as readonly string[]).includes(p)
    ? (p as KlinePeriodKey)
    : null;
}

/** 模块内别名（paint/ensureScene 使用同源实现） */
const asPeriodKey = asKlinePeriodKey;

// ───────────────────────────── 槽状态（面板状态行消费） ─────────────────────────────

export type SlotStatus = "ok" | "stale" | "failed" | "hidden" | "loading";

export interface SlotStateInfo {
  index: number;
  slot: IchimokuSliceSlotCfg;
  status: SlotStatus;
  reason: string;
}

/** 各槽数据态推导（overlay 工厂共用的纯函数；loading 为四态词汇外的拉取中态，
 *  仅在尚未拿到任何 store 条目时出现） */
export function ichimokuSlotStates(state: IchimokuSharedState): SlotStateInfo[] {
  const cfg = state.cfg;
  const chartKey = asPeriodKey(state.chartPeriod);
  const chartSec = chartKey ? periodSeconds(chartKey) : null;
  return cfg.slices.slots.map((slot, index): SlotStateInfo => {
    if (!cfg.slices.on) return { index, slot, status: "hidden", reason: "切片总开关关" };
    if (!slot.on) return { index, slot, status: "hidden", reason: "槽未启用" };
    if (chartSec != null && periodSeconds(slot.tf) <= chartSec) {
      return { index, slot, status: "hidden", reason: "≤图表周期" };
    }
    if (!state.symbol) return { index, slot, status: "loading", reason: "无品种" };
    const entry = state.store.get(state.symbol, slot.tf);
    if (!entry) return { index, slot, status: "loading", reason: "拉取中" };
    if (entry.failed) {
      return entry.bars.length
        ? { index, slot, status: "stale", reason: "拉取失败·用旧数据" }
        : { index, slot, status: "failed", reason: "拉取失败·无数据" };
    }
    if (!entry.bars.length) return { index, slot, status: "hidden", reason: "源无数据" };
    if (entry.bars.length < slot.n) {
      return { index, slot, status: "hidden", reason: `数据不足 ${slot.n} 根` };
    }
    return { index, slot, status: "ok", reason: "" };
  });
}

// ───────────────────────────── scene 组装（memoized，视口无关） ─────────────────────────────

/** 主图 scene：宿主 bars 映射 + 引擎输出 */
interface MainScene {
  bars: OhlcBar[];
  series: IchimokuSeries;
  params: ResolvedParams;
}

/** 单槽 scene：槽 bars + 槽自身参数引擎输出 */
interface SlotScene {
  slot: IchimokuSliceSlotCfg;
  bars: OhlcBar[];
  series: IchimokuSeries;
  params: ResolvedParams;
}

interface Scene {
  main: MainScene | null;
  slots: SlotScene[];
}

/** RenderContext.data → OhlcBar[]（字段实名 timestamp/open/high/low/close；
 *  任一条目缺 OHLC（分时视图）→ null：主图与切片整体不画） */
function toOhlcBars(data: ReadonlyArray<ChartSeriesDatum>): OhlcBar[] | null {
  const bars: OhlcBar[] = [];
  for (const d of data) {
    if (
      typeof d.timestamp !== "number" ||
      !("open" in d) || !("high" in d) || !("low" in d) || !("close" in d) ||
      typeof d.open !== "number" || typeof d.high !== "number" ||
      typeof d.low !== "number" || typeof d.close !== "number"
    ) {
      return null;
    }
    bars.push({ t: d.timestamp, o: d.open, h: d.high, l: d.low, c: d.close });
  }
  return bars;
}

/** 数据签名 = n + 首根 t + 末根 t + period（禁 JSON.stringify 整个 bars） */
function dataSigOf(data: ReadonlyArray<ChartSeriesDatum>, period: string): string {
  const n = data.length;
  return `${n}|${n ? data[0].timestamp : 0}|${n ? data[n - 1].timestamp : 0}|${period}`;
}

// ───────────────────────────── overlay 工厂 ─────────────────────────────

/** 切片布局常量（Pine ⑫ 烧录）：起始空档 26 根；实体宽 2 + 间 1 → pitch=3
 *  （canvas 端不暴露 K线宽/间输入，按 Pine 缺省固定）；总前瞻 ≤480 根 */
const SL_PAD = 26;
const SL_BW = 2;
const SL_PITCH = 3;
const SL_X_LIM = 480;

/** 临时 spike，验证 #283：fork 的 RendererPlugin 类型 upstream/main 未导出（#283 改用
 *  Layer 契约），此处按 fork 原返回对象形状补一个结构最小类型，draw 消费不变。 */
export interface IchimokuOverlayPlugin {
  name: string;
  version: string;
  description: string;
  debugName: string;
  paneId: string;
  priority: number;
  layer: string;
  draw(context: RenderContext): void;
  getConfig(): { cfg: IchimokuCfg };
  onUninstall(): void;
}

export function createIchimokuOverlay(state: IchimokuSharedState): IchimokuOverlayPlugin {
  // scene 缓存（签名判等去重；跨帧复用，视口无关）
  let scene: Scene = { main: null, slots: [] };
  let mainDataSig = "";
  let mainParamSig = "";
  const slotCache = new Map<number, { sig: string; scene: SlotScene | null }>();

  /** 组装/复用 scene（draw 每帧调用，签名不变零重算） */
  function ensureScene(context: RenderContext): void {
    const cfg = state.cfg;
    const chartKey = asPeriodKey(context.period);

    // 主图序列
    const dataSig = dataSigOf(context.data, context.period);
    const mainParams = chartKey ? resolveParamsSafe(chartKey, cfg, state.regime) : null;
    const paramSig = JSON.stringify({ p: mainParams, cm: cfg.countMode, d: cfg.display });
    if (mainParams === null) {
      scene.main = null;
      mainDataSig = dataSig; // 非 K 线视图/未知周期：同样记签，避免每帧重映射
      mainParamSig = paramSig;
    } else if (dataSig !== mainDataSig || paramSig !== mainParamSig) {
      const bars = toOhlcBars(context.data);
      scene.main = bars && bars.length
        ? {
            bars,
            series: computeIchimoku(bars, { tenkan: mainParams.tenkan, kijun: mainParams.kijun, senkouB: mainParams.senkouB, countMode: cfg.countMode }),
            params: mainParams,
          }
        : null;
      mainDataSig = dataSig;
      mainParamSig = paramSig;
    }

    // HTF 槽（store 缓存 → 签名判等 → 引擎重算；总开关/槽开关关闭不进本帧槽表）
    for (let i = 0; i < cfg.slices.slots.length; i++) {
      const slot = cfg.slices.slots[i];
      if (!cfg.slices.on || !slot.on) continue;
      const params = resolveParamsSafe(slot.tf, cfg, state.regime);
      const entry = state.symbol ? state.store.get(state.symbol, slot.tf) : null;
      const sig = entry
        ? `${entry.fetchedAt}|${entry.bars.length}|${entry.bars.length ? entry.bars[0].t : 0}|${entry.bars.length ? entry.bars[entry.bars.length - 1].t : 0}|${slot.n}|${JSON.stringify({ p: params, cm: cfg.countMode })}`
        : "none";
      const cached = slotCache.get(i);
      if (cached && cached.sig === sig) {
        if (cached.scene) pushSlot(cached.scene);
        continue;
      }
      let built: SlotScene | null = null;
      if (entry && entry.bars.length >= slot.n && params) {
        built = {
          slot,
          bars: entry.bars,
          series: computeIchimoku(entry.bars, { tenkan: params.tenkan, kijun: params.kijun, senkouB: params.senkouB, countMode: cfg.countMode }),
          params,
        };
      }
      slotCache.set(i, { sig, scene: built });
      if (built) pushSlot(built);
    }
  }

  /** resolveParams 薄封装（保持 import 局部化） */
  function resolveParamsSafe(period: KlinePeriodKey, cfg: IchimokuCfg, regime: MarketRegime): ResolvedParams {
    return resolveParams(period, cfg, regime);
  }

  /** 本帧可画槽累积（每帧重建，避免上一帧已隐藏槽残留） */
  let frameSlots: SlotScene[] = [];
  function pushSlot(s: SlotScene): void {
    frameSlots.push(s);
  }

  // ───────────────────────────── paint（每帧） ─────────────────────────────

  let lastErrAt = 0;

  function paint(context: RenderContext): void {
    state.chartPeriod = context.period; // 回写图表周期（工厂/面板消费）
    const cfg = state.cfg;
    frameSlots = [];

    // ── 帧一致性守卫（外部渲染层防抖核心）──
    // 宿主在 周期切换/品种切换/数据 prepend 竞态窗口内，可能向本层传入
    // 「数据数组与逻辑索引解析不同帧」的 RenderContext（实证：ghost 取证抓到
    // data[0]=2026-08-19 同帧 data[174]=2025-11-09 的错帧上下文）。错帧时
    // 蜡烛层与本层内容互斥交替 = 抖动/伪影。探测首末两根往返映射必须闭合，
    // 不闭合 = 陈旧帧，直接跳过本帧（层画布保留上一帧内容，视觉零扰动）。
    const dArr = context.data as ReadonlyArray<{ timestamp?: number }>;
    const d0 = dArr[0]?.timestamp;
    const dN = dArr[dArr.length - 1]?.timestamp;
    if (typeof d0 === "number" && typeof dN === "number") {
      const li0 = context.getLogicalIndexAtTimestamp(d0);
      const liN = context.getLogicalIndexAtTimestamp(dN);
      const n1 = dArr.length - 1;
      if (li0 !== 0 || liN !== n1 || dArr[li0]?.timestamp !== d0 || dArr[liN]?.timestamp !== dN) {
        return;
      }
    }
    ensureScene(context);
    if (!scene.main && !frameSlots.length) return;

    const g = context.ctx;
    const pane = context.pane;
    const range = context.range;
    const centers = context.kLineCenters;
    const scrollLeft = context.scrollLeft;
    const paneWidth = context.paneWidth ?? (pane as { width?: number }).width ?? 800;
    const toY = (v: number): number => pane.yAxis.priceToY(v);

    g.save();
    try {
      // 坐标铁律（optionsOverlay 两轮返工实证）：kLineCenters=内容绝对坐标
      // （scrollLeft 空间），translate(-scrollLeft) 落屏幕空间；越界索引按末根
      // 间距线性外推（未来区切片/云块），可见窗内直接取 kLineCenters[i-range.start]
      const spacing = centers.length >= 2
        ? centers[centers.length - 1] - centers[centers.length - 2]
        : context.kWidth + context.kGap;
      const xOfIdx = (i: number): number | null => {
        if (!centers.length) return null;
        const ci = i - range.start;
        if (ci >= 0 && ci < centers.length) {
          const x = centers[ci];
          if (Number.isFinite(x)) return x;
        }
        const baseCi = Math.min(Math.max(ci, 0), centers.length - 1);
        const bx = centers[baseCi];
        return Number.isFinite(bx) ? bx + (ci - baseCi) * spacing : null;
      };
      /** 时间 → 逻辑下标（历史锚定图元；映射不到返回 null 由调用方跳过） */
      const logicalAt = (ts: number): number | null => context.getLogicalIndexAtTimestamp(ts);
      /** 逻辑下标 → 落点 bar 时间戳（落点合法性校验用） */
      const dataTsAt = (i: number): number | undefined =>
        (context.data[i] as { timestamp?: number } | undefined)?.timestamp;

      // 防御上游层间状态污染（optionsOverlay 同款）：每帧复位 alpha/字体/虚线
      g.globalAlpha = 1;
      g.setLineDash([]);
      // 本层全部按内容空间（scrollLeft 空间）计算——此处统一落屏幕空间
      g.translate(-scrollLeft, 0);

      // ① K线染色（paintBars；云上绿/云下红/云中灰 半透明 tint）
      if (cfg.display.paintBars && scene.main) {
        paintBarsTint(g, context, scene.main, toY, xOfIdx);
      }
      // ② 云填充 + A/B 边线
      if (cfg.display.kumo && scene.main) {
        paintMainKumo(g, context, scene.main, toY, xOfIdx);
      }
      // ③ ghost 带（历史区，垫在主图线下；槽 tf ≤ 图表 tf 的槽不画）
      const chartKey = asPeriodKey(context.period);
      const chartSec = chartKey ? periodSeconds(chartKey) : null;
      const eligible = frameSlots.filter(
        (s) => slotVisible(s) && chartSec != null && periodSeconds(s.slot.tf) > chartSec,
      );
      if (cfg.slices.ghost) {
        for (const s of eligible) {
          paintGhostBand(g, s, toY, xOfIdx, logicalAt, dataTsAt, spacingOf(context));
        }
      }
      // ④ 主图转折线 / 基准线（宽 = 三主线线宽）
      if (scene.main) {
        paintMainLine(g, context, scene.main.series.tenkan, toY, xOfIdx,
          cfg.display.tenkan ? C_TENKAN : null, cfg.display.lineWidth, false);
        paintMainLine(g, context, scene.main.series.kijun, toY, xOfIdx,
          cfg.display.kijun ? C_KIJUN : null, cfg.display.lineWidth, false);
      }
      // ⑤ 主图延迟线（虚线，直接画 series.chikou；深色图白/浅色图深灰——Pine
      // 白色默认按深色图烧录，浅色主题下不可见）
      if (scene.main) {
        paintMainLine(g, context, scene.main.series.chikou, toY, xOfIdx,
          cfg.display.chikou ? (state.themeDark ? C_CHIKOU : C_CHIKOU_LIGHT) : null, cfg.display.lineWidth, true);
      }
      // ⑥ HTF 延迟左绘（灰虚线，压在 ghost 之上——Pine L814-815 注：相遇关系不被盖）
      if (cfg.slices.chikouLeft) {
        for (const s of eligible) {
          paintChikouLeft(g, s, toY, xOfIdx, logicalAt, dataTsAt);
        }
      }
      // ⑦ 右侧切片（K线/折线/对齐云/未来云/TF 标志/倒计时） + ⑧ 组尾价签
      paintSlices(g, context, toY, xOfIdx, logicalAt, eligible, paneWidth, scrollLeft);
    } catch (err) {
      const now = Date.now();
      if (now - lastErrAt > 10_000) {
        lastErrAt = now;
        console.error("[kcq_ichimoku] draw 异常（10s 限频，不回抛）：", err);
      }
    } finally {
      g.restore();
    }
  }

  /** 影线贴齐用的图表 bar 毫秒（末两根时间差优先，退化为理论周期） */
  function spacingOf(context: RenderContext): number {
    const n = context.data.length;
    if (n >= 2) {
      const dt = context.data[n - 1].timestamp - context.data[n - 2].timestamp;
      if (dt > 0) return dt;
    }
    const key = asPeriodKey(context.period);
    return key ? periodSeconds(key) * 1000 : 3_600_000;
  }

  /** 槽 x 范围与可视区粗相交判定（纵深裁剪，省未来区全量绘制） */
  function slotVisible(s: SlotScene): boolean {
    return s.bars.length >= s.slot.n; // 精确裁剪在 paintSlices 内按布局做
  }

  // ── ① K线染色：收在云上绿 / 云下红 / 云中灰（Pine barcolor L476）──
  function paintBarsTint(
    g: CanvasRenderingContext2D,
    context: RenderContext,
    main: MainScene,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
  ): void {
    const { range, kBarRects } = context;
    const n = main.bars.length;
    const start = Math.max(range.start, 0);
    const end = Math.min(range.end, n);
    g.save();
    g.globalAlpha = 0.45;
    g.lineWidth = 1;
    for (let i = start; i < end; i++) {
      const top = main.series.kumoTop[i];
      const bot = main.series.kumoBot[i];
      if (!Number.isFinite(top) || !Number.isFinite(bot)) continue;
      const bar = main.bars[i];
      const color = bar.c > top ? C_BAR_BULL : bar.c < bot ? C_BAR_BEAR : C_BAR_FLAT;
      const x = xOfIdx(i);
      if (x == null) continue;
      const ci = i - range.start;
      const rect = ci >= 0 && ci < kBarRects.length ? kBarRects[ci] : null;
      const xNext = xOfIdx(i + 1);
      const bw = rect ? rect.width
        : xNext != null ? Math.max(1, Math.abs(xNext - x) * 0.7)
        : 6;
      const yH = toY(bar.h);
      const yL = toY(bar.l);
      const yO = toY(bar.o);
      const yC = toY(bar.c);
      if (![yH, yL, yO, yC].every(Number.isFinite)) continue;
      g.strokeStyle = color;
      g.beginPath();
      g.moveTo(x, yH);
      g.lineTo(x, yL);
      g.stroke();
      const x0 = rect ? rect.x : x - bw / 2;
      const bTop = Math.min(yO, yC);
      const h = Math.max(1, Math.abs(yC - yO));
      g.fillStyle = color;
      g.fillRect(x0, bTop, Math.max(1, bw), h);
    }
    g.restore();
  }

  // ── ② 主图云：填充（A/B 之间逐段四边形）+ A/B 边线（Pine L472-473 + fill）──
  function paintMainKumo(
    g: CanvasRenderingContext2D,
    context: RenderContext,
    main: MainScene,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
  ): void {
    const { range } = context;
    const n = main.bars.length;
    // 未来延伸（Pine plot offset=+disp 语义）：末根之后 disp 根的云 = 原始
    // senkouA/B[i−disp]（i≥n 时 i−disp∈[n−disp,n) 恒为已计算值），x 由 xOfIdx 线性外推
    const disp = main.params.disp;
    const total = n + disp;
    const valA = (i: number): number =>
      i < n ? main.series.dispA[i]
        : i - disp >= 0 && i - disp < n ? main.series.senkouA[i - disp] : NaN;
    const valB = (i: number): number =>
      i < n ? main.series.dispB[i]
        : i - disp >= 0 && i - disp < n ? main.series.senkouB[i - disp] : NaN;
    const start = Math.max(range.start, 0);
    const end = Math.min(range.end, total - 1);
    if (end - start < 2) return;
    g.save();
    // 填充：多头 #FF9800 / 空头 #636363（Pine transp 85 → alpha 0.15）
    g.globalAlpha = 1;
    for (let i = start; i < end; i++) {
      const a0 = valA(i), b0 = valB(i), a1 = valA(i + 1), b1 = valB(i + 1);
      if (![a0, b0, a1, b1].every(Number.isFinite)) continue;
      const x0 = xOfIdx(i), x1 = xOfIdx(i + 1);
      if (x0 == null || x1 == null) continue;
      const ya0 = toY(a0), ya1 = toY(a1), yb0 = toY(b0), yb1 = toY(b1);
      if (![ya0, ya1, yb0, yb1].every(Number.isFinite)) continue;
      g.fillStyle = a0 >= b0 ? rgba(C_SPAN_A, pineAlpha(85)) : rgba(C_SPAN_B, pineAlpha(85));
      g.beginPath();
      g.moveTo(x0, ya0);
      g.lineTo(x1, ya1);
      g.lineTo(x1, yb1);
      g.lineTo(x0, yb0);
      g.closePath();
      g.fill();
    }
    // 边线 A/B（Pine transp 40 → alpha 0.6，宽 2；同样延伸未来区）
    strokeSeriesFn(g, context, valA, total, toY, xOfIdx, rgba(C_SPAN_A, pineAlpha(40)), 2);
    strokeSeriesFn(g, context, valB, total, toY, xOfIdx, rgba(C_SPAN_B, pineAlpha(40)), 2);
    g.restore();
  }

  /** 可见窗内序列折线（NaN 断段；dash=true 白虚线延迟线） */
  function strokeSeries(
    g: CanvasRenderingContext2D,
    context: RenderContext,
    values: Float64Array,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    color: string | null,
    width: number,
    dash = false,
  ): void {
    if (!color) return;
    const { range } = context;
    const n = values.length;
    const start = Math.max(range.start, 0);
    const end = Math.min(range.end, n);
    if (end - start < 2) return;
    g.save();
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash(dash ? [6, 4] : []);
    g.beginPath();
    let started = false;
    for (let i = start; i < end; i++) {
      const v = values[i];
      const x = xOfIdx(i);
      if (!Number.isFinite(v) || x == null) {
        started = false;
        continue;
      }
      const y = toY(v);
      if (!Number.isFinite(y)) {
        started = false;
        continue;
      }
      if (started) g.lineTo(x, y);
      else {
        g.moveTo(x, y);
        started = true;
      }
    }
    g.stroke();
    g.restore();
  }

  /** 访问器版折线（主图云边线未来延伸用）：get(i) 取值，len=逻辑总长 */
  function strokeSeriesFn(
    g: CanvasRenderingContext2D,
    context: RenderContext,
    get: (i: number) => number,
    len: number,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    color: string | null,
    width: number,
  ): void {
    if (!color) return;
    const { range } = context;
    const start = Math.max(range.start, 0);
    const end = Math.min(range.end, len - 1);
    if (end - start < 1) return;
    g.save();
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash([]);
    g.beginPath();
    let started = false;
    for (let i = start; i <= end; i++) {
      const v = get(i);
      const x = xOfIdx(i);
      if (!Number.isFinite(v) || x == null) {
        started = false;
        continue;
      }
      const y = toY(v);
      if (!Number.isFinite(y)) {
        started = false;
        continue;
      }
      if (started) g.lineTo(x, y);
      else {
        g.moveTo(x, y);
        started = true;
      }
    }
    g.stroke();
    g.restore();
  }

  function paintMainLine(
    g: CanvasRenderingContext2D,
    context: RenderContext,
    values: Float64Array,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    color: string | null,
    width: number,
    dash: boolean,
  ): void {
    strokeSeries(g, context, values, toY, xOfIdx, color, width, dash);
  }

  // ── ③ ghost 带（Pine f_slGhostBand L713-771，v2.22 设计全宽窗）──
  function paintGhostBand(
    g: CanvasRenderingContext2D,
    s: SlotScene,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    logicalAt: (ts: number) => number | null,
    dataTsAt: (i: number) => number | undefined,
    chartMs: number,
  ): void {
    const cfg = state.cfg;
    const pad = cfg.slices.ghostPad;
    const chiN = cfg.slices.chiN;
    const d = s.params.disp;
    const bars = s.bars;
    const sz = bars.length;
    if (sz <= 0 || chartMs <= 0) return;
    const tfMs = periodSeconds(s.slot.tf) * 1000;
    const jHi = Math.min(sz - 1, sz - 1 - Math.max(0, d - pad));
    const winEff = chiN + 2 * pad;
    const jLo = Math.max(Math.max(0, sz - (d + chiN + pad)), jHi + 1 - winEff);
    g.save();
    for (let j = jLo; j <= jHi; j++) {
      const b = bars[j];
      if (![b.t, b.o, b.h, b.l, b.c].every(Number.isFinite)) continue;
      const t0 = b.t;
      const t1 = j + 1 < sz ? bars[j + 1].t : t0 + tfMs;
      const li = logicalAt(t0);
      if (li == null) continue; // 映射不到落点：整根跳过
      // 落点合法性校验：映射落点 bar 的时间必须落在该 HTF 根自己的时间桶内
      // （错帧上下文/异周期数据混入时，时间戳映射会命中异类 bar——实证伪影源）
      const landedTs = dataTsAt(li);
      if (landedTs === undefined || Math.abs(landedTs - t0) > tfMs / 2) continue;
      const ri = logicalAt(t1) ?? li + Math.max(1, Math.round((t1 - t0) / chartMs));
      const xl = xOfIdx(li);
      const xr = xOfIdx(ri);
      if (xl == null || xr == null || xr <= xl) continue;
      const up = b.c >= b.o;
      const bTopY = toY(Math.max(b.o, b.c));
      const bBotY = toY(Math.min(b.o, b.c));
      if (!Number.isFinite(bTopY) || !Number.isFinite(bBotY)) continue;
      // 实体（边框全透明不描——Pine slGhBoT 缺省 100）
      g.fillStyle = rgba(up ? C_SLICE_UP : C_SLICE_DN, pineAlpha(75));
      g.fillRect(xl, bTopY, xr - xl, Math.max(1, bBotY - bTopY));
      // 两段式影线（宽 4 α80；零长段不画；canvas 无 lines 预算，不设 Pine L754 护栏）
      const xw = xOfIdx((li + ri) / 2);
      const yH = toY(b.h);
      const yL = toY(b.l);
      if (xw == null || !Number.isFinite(yH) || !Number.isFinite(yL)) continue;
      g.strokeStyle = rgba("#000000", pineAlpha(80));
      g.lineWidth = 4;
      g.beginPath();
      if (b.h > Math.max(b.o, b.c)) {
        g.moveTo(xw, yH);
        g.lineTo(xw, bTopY);
      }
      if (b.l < Math.min(b.o, b.c)) {
        g.moveTo(xw, bBotY);
        g.lineTo(xw, yL);
      }
      g.stroke();
    }
    g.restore();
  }

  // ── ⑥ HTF 延迟左绘（Pine f_slChikouLeft L689-705 v2.22.1 根数偏移）──
  function paintChikouLeft(
    g: CanvasRenderingContext2D,
    s: SlotScene,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    logicalAt: (ts: number) => number | null,
    dataTsAt: (i: number) => number | undefined,
  ): void {
    const nn = Math.min(state.cfg.slices.chiN, s.bars.length);
    const d = s.params.disp;
    const sz = s.bars.length;
    if (nn < 2 || sz <= d) return;
    g.save();
    g.strokeStyle = C_HTF_CHIKOU;
    g.lineWidth = 1;
    g.setLineDash([4, 3]);
    g.beginPath();
    let started = false;
    for (let i = 0; i + 1 < nn; i++) {
      const ja = sz - nn + i - d;
      const jb = ja + 1;
      if (ja < 0 || jb < 0) break;
      const ia = logicalAt(s.bars[ja].t);
      const ib = logicalAt(s.bars[jb].t);
      if (ia == null || ib == null) continue; // 映射不到的段跳过
      // 落点合法性校验（同 ghost）：落点 bar 时间须落在 HTF 根自己的时间桶内
      const tfMs2 = periodSeconds(s.slot.tf) * 1000;
      const la = dataTsAt(ia);
      const lb = dataTsAt(ib);
      if (la === undefined || lb === undefined) continue;
      if (Math.abs(la - s.bars[ja].t) > tfMs2 / 2 || Math.abs(lb - s.bars[jb].t) > tfMs2 / 2) {
        started = false;
        continue;
      }
      const xa = xOfIdx(ia);
      const xb = xOfIdx(ib);
      const ya = toY(s.bars[sz - nn + i].c);
      const yb = toY(s.bars[sz - nn + i + 1].c);
      if (xa == null || xb == null || ![ya, yb].every(Number.isFinite)) {
        started = false;
        continue;
      }
      if (started) g.lineTo(xb, yb);
      else {
        g.moveTo(xa, ya);
        started = true;
      }
      void xb;
    }
    g.stroke();
    // 线端标 `<TF>·延迟`
    const exi = logicalAt(s.bars[sz - 1 - d].t);
    const ey = toY(s.bars[sz - 1].c);
    const ex = exi != null ? xOfIdx(exi) : null;
    if (ex != null && Number.isFinite(ey)) {
      g.setLineDash([]);
      g.fillStyle = C_HTF_CHIKOU;
      g.font = "10px sans-serif";
      g.textAlign = "left";
      g.textBaseline = "bottom";
      g.fillText(`${tfName(s.slot.tf)}·延迟`, Math.round(ex) + 4, Math.round(ey) - 3);
    }
    g.restore();
  }

  // ── ⑦⑧ 右侧切片组（Pine 主流程 L773-835 + f_slSlot L606-681）──
  function paintSlices(
    g: CanvasRenderingContext2D,
    context: RenderContext,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    logicalAt: (ts: number) => number | null,
    eligible: SlotScene[],
    paneWidth: number,
    scrollLeft: number,
  ): void {
    const cfg = state.cfg.slices;
    const n = context.data.length;
    if (n <= 0) return;
    const lastIdx = n - 1;
    const tags: Array<{ x: number; y: number; text: string; color: string }> = [];
    let cur = lastIdx + SL_PAD;
    const xLim = lastIdx + SL_X_LIM;
    g.save();
    g.font = "10px sans-serif";
    for (const s of eligible) {
      const wS = s.slot.n * SL_PITCH + cfg.fut;
      if (cur + wS > xLim) continue; // 放不下的整槽跳过
      // 纵深裁剪：槽 x 范围与可视区不相交则跳过（cur 仍推进，保持 Pine 布局序）
      const slotL = xOfIdx(cur);
      const slotR = xOfIdx(cur + wS);
      if (slotL == null || slotR == null || slotR < scrollLeft - 64 || slotL > scrollLeft + paneWidth + 64) {
        cur += wS + cfg.gap;
        continue;
      }
      drawSlot(g, s, cur, toY, xOfIdx, logicalAt, tags);
      cur += wS + cfg.gap;
    }
    // ⑧ 组尾裸价格价签（画在所有切片之上）
    g.textAlign = "left";
    g.textBaseline = "middle";
    for (const t of tags) {
      if (!Number.isFinite(t.y)) continue;
      g.fillStyle = t.color;
      g.fillText(t.text, Math.round(t.x) + 4, Math.round(t.y));
    }
    g.restore();
  }

  function drawSlot(
    g: CanvasRenderingContext2D,
    s: SlotScene,
    x0: number,
    toY: (v: number) => number,
    xOfIdx: (i: number) => number | null,
    logicalAt: (ts: number) => number | null,
    tags: Array<{ x: number; y: number; text: string; color: string }>,
  ): void {
    const cfg = state.cfg.slices;
    const nS = s.slot.n;
    const bars = s.bars;
    const sz = bars.length;
    const ser = s.series;
    const d = s.params.disp;
    const sp = 1; // Pine slSp 缺省
    const centerIdx = (k: number): number => x0 + k * SL_PITCH + SL_BW / 2;

    // 切片 K 线（阴阳实体 + 两段式影线；Pine f_slCandles L585-604）
    for (let k = 0; k < nS; k++) {
      const b = bars[sz - nS + k];
      const up = b.c >= b.o;
      const color = up ? C_SLICE_UP : C_SLICE_DN;
      const xc = xOfIdx(centerIdx(k));
      const xl = xOfIdx(x0 + k * SL_PITCH);
      const xr = xOfIdx(x0 + k * SL_PITCH + SL_BW);
      if (xc == null || xl == null || xr == null) continue;
      const yH = toY(b.h), yL = toY(b.l), yO = toY(b.o), yC = toY(b.c);
      if (![yH, yL, yO, yC].every(Number.isFinite)) continue;
      const bTop = Math.min(yO, yC);
      const bBot = Math.max(yO, yC);
      g.save();
      g.strokeStyle = color;
      g.fillStyle = color;
      g.lineWidth = 1;
      g.beginPath();
      if (b.h > Math.max(b.o, b.c)) {
        g.moveTo(xc, yH);
        g.lineTo(xc, bTop);
      }
      if (b.l < Math.min(b.o, b.c)) {
        g.moveTo(xc, bBot);
        g.lineTo(xc, yL);
      }
      g.stroke();
      g.fillRect(xl, bTop, Math.max(1, xr - xl), Math.max(1, bBot - bTop));
      g.restore();
    }

    // 槽自身参数转折/基准折线（宽 1；Pine L614-618）
    strokeSlotLine(g, ser.tenkan, sz, nS, centerIdx, xOfIdx, toY, C_TENKAN);
    strokeSlotLine(g, ser.kijun, sz, nS, centerIdx, xOfIdx, toY, C_KIJUN);

    // 对齐云（dispA/dispB 末 n 段盒）+ 未来云（raw senkouA/B[n-1-(d-k)]，只用已确定值）
    const fa: number[] = [];
    const fb: number[] = [];
    for (let i = 0; i < nS; i++) {
      fa.push(ser.dispA[sz - nS + i]);
      fb.push(ser.dispB[sz - nS + i]);
    }
    if (cfg.fut > 0) {
      for (let k = 1; k <= cfg.fut; k++) {
        const iR = sz - 1 - (d - k);
        if (iR < 0 || iR >= sz) continue;
        fa.push(ser.senkouA[iR]);
        fb.push(ser.senkouB[iR]);
      }
    }
    g.save();
    for (let i = 0; i + 1 < fa.length; i++) {
      const a0 = fa[i], b0 = fb[i], a1 = fa[i + 1], b1 = fb[i + 1];
      if (![a0, b0, a1, b1].every(Number.isFinite)) continue;
      const xl = xOfIdx(x0 + i * SL_PITCH);
      const xr = xOfIdx(x0 + (i + 1) * SL_PITCH);
      if (xl == null || xr == null || xr <= xl) continue;
      const ya0 = toY(a0), ya1 = toY(a1), yb0 = toY(b0), yb1 = toY(b1);
      if (![ya0, ya1, yb0, yb1].every(Number.isFinite)) continue;
      g.fillStyle = a0 >= b0 ? rgba(C_SPAN_A, pineAlpha(85)) : rgba(C_SPAN_B, pineAlpha(85));
      g.beginPath();
      g.moveTo(xl, ya0);
      g.lineTo(xr, ya1);
      g.lineTo(xr, yb1);
      g.lineTo(xl, yb0);
      g.closePath();
      g.fill();
    }

    // 组极值（TF 标志锚点；Pine L631-642）
    let gTop = bars[sz - 1].h;
    let gBot = bars[sz - 1].l;
    for (let i = 0; i < nS; i++) {
      gTop = Math.max(gTop, bars[sz - nS + i].h);
      gBot = Math.min(gBot, bars[sz - nS + i].l);
    }
    for (let i = 0; i < fa.length; i++) {
      if (Number.isFinite(fa[i])) gTop = Math.max(gTop, fa[i]);
      if (Number.isFinite(fb[i])) gBot = Math.min(gBot, fb[i]);
    }

    // TF 标志上下各一枚 + 收线倒计时（本地时钟每次 draw 重算）
    const yTop = toY(gTop);
    const yBot = toY(gBot);
    const lxc = xOfIdx(x0 + (nS * SL_PITCH - sp) / 2);
    if (lxc != null && Number.isFinite(yTop) && Number.isFinite(yBot)) {
      let txt = tfName(s.slot.tf);
      if (cfg.timeLeft) {
        const rem = nextCloseMs(bars[sz - 1].t, s.slot.tf) - Date.now();
        if (rem > 0) txt += `\n${fmtRemain(rem)}`;
      }
      const lines = txt.split("\n");
      g.fillStyle = C_TF_TEXT;
      g.textAlign = "center";
      g.textBaseline = "bottom";
      for (let li = 0; li < lines.length; li++) {
        g.fillText(lines[li], Math.round(lxc), Math.round(yTop) - 4 - li * 12);
      }
      g.textBaseline = "top";
      for (let li = 0; li < lines.length; li++) {
        g.fillText(lines[li], Math.round(lxc), Math.round(yBot) + 4 + li * 12);
      }
    }

    // 组尾裸价格价签（转折/基准/云顶/云底；先行带色 ×0.72 加深；Pine L658-675）
    if (cfg.tags) {
      const xAxisIdx = x0 + nS * SL_PITCH - sp + 1;
      const xTag = xOfIdx(xAxisIdx);
      if (xTag != null) {
        const vT = ser.tenkan[sz - 1];
        const vK = ser.kijun[sz - 1];
        const vA = ser.dispA[sz - 1];
        const vB = ser.dispB[sz - 1];
        if (Number.isFinite(vT)) tags.push({ x: xTag, y: toY(vT), text: fmtPrice(vT), color: C_TENKAN });
        if (Number.isFinite(vK)) tags.push({ x: xTag, y: toY(vK), text: fmtPrice(vK), color: C_KIJUN });
        if (Number.isFinite(vA) && Number.isFinite(vB)) {
          tags.push({ x: xTag, y: toY(Math.max(vA, vB)), text: fmtPrice(Math.max(vA, vB)), color: shade(C_SPAN_A, 0.72) });
          tags.push({ x: xTag, y: toY(Math.min(vA, vB)), text: fmtPrice(Math.min(vA, vB)), color: shade(C_SPAN_B, 0.72) });
        }
      }
    }

    // 收线标签（延迟线右端下一落点 + 倒计时；Pine L760-771）
    if (cfg.closeLabel && sz > d - 1) {
      const msRem = nextCloseMs(bars[sz - 1].t, s.slot.tf) - Date.now();
      if (msRem > 0) {
        const li = logicalAt(bars[sz - d].t);
        const x = li != null ? xOfIdx(li) : null;
        const y = toY(bars[sz - 1].c);
        if (x != null && Number.isFinite(y)) {
          g.fillStyle = C_CLOSE_LBL;
          g.textAlign = "left";
          g.textBaseline = "bottom";
          g.fillText(`${tfName(s.slot.tf)}收线 ${fmtRemain(msRem)}`, Math.round(x) + 4, Math.round(y) - 3);
        }
      }
    }
    g.restore();
  }

  function strokeSlotLine(
    g: CanvasRenderingContext2D,
    values: Float64Array,
    sz: number,
    nS: number,
    centerIdx: (k: number) => number,
    xOfIdx: (i: number) => number | null,
    toY: (v: number) => number,
    color: string,
  ): void {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    let started = false;
    for (let i = 0; i + 1 < nS; i++) {
      const v0 = values[sz - nS + i];
      const v1 = values[sz - nS + i + 1];
      const x0 = xOfIdx(centerIdx(i));
      const x1 = xOfIdx(centerIdx(i + 1));
      if (![v0, v1].every(Number.isFinite) || x0 == null || x1 == null) {
        started = false;
        continue;
      }
      const y0 = toY(v0);
      const y1 = toY(v1);
      if (![y0, y1].every(Number.isFinite)) {
        started = false;
        continue;
      }
      if (started) g.lineTo(x1, y1);
      else {
        g.moveTo(x0, y0);
        started = true;
      }
    }
    g.stroke();
    g.restore();
  }

  return {
    name: "kcq_ichimoku_overlay",
    version: "1.0.0",
    description: "一目均衡表套件：云/三线/延迟/HTF 右侧切片（Pine IchimokuMTF 语义移植）",
    debugName: "KcqIchimoku",
    paneId: "main",
    priority: 49, // 垫在期权插件 priority:50 之下（先画，被期权关键位射线覆盖）
    layer: "overlay",
    draw(context: RenderContext): void {
      paint(context);
    },
    getConfig() {
      return { cfg: state.cfg };
    },
    onUninstall() {
      /* timer/订阅/DOM 由工厂（ichimoku.ts）统一清理 */
    },
  };
}
