/* 临时 spike，验证 upstream #283：本文件自我方闭源资产 kcq-plugins 原样复制，仅做上游兼容性适配（改动见各处 spike 标注），勿当生产代码。 */

/** 一目均衡表纯函数引擎：零 IO 零状态零时区（二期统计引擎直接复用）。
 *
 *  语义权威 = D:\AI\Ichimoku-MTF\pine\IchimokuMTF_cn.pine：
 *  - L300 donchian(len) = avg(highest(high,len), lowest(low,len)) —— 三线全是
 *    Donchian 中轨，不是均线（L405-408：tenkan/kijun/senkouB 同构，只换窗口长）
 *  - L407 senkouA = avg(tenkan, kijun)；L411-412 senkouA[disp]/senkouB[disp]
 *    位移对齐；L413-414 kumoTop/kumoBot = max/min(位移后 A, B)
 *  - L99 disp = 原著修正 ? kijun−1 : kijun（走 ichimokuParams.dispOf 单一真值源）
 *  - 延迟线：Pine plot(close, offset=-disp) 把当前收盘画到 disp 根前 → 数组第 i
 *    槽存 close[i+disp]（尾部 disp 根 NaN）
 *  - 窗口不足输出 NaN，warmup = max(tenkan,kijun,senkouB)（首个有效下标 =
 *    warmup−1）；滚动窗口单调队列 O(n)，任何索引只回看不前瞻（chikou 的
 *    「取未来收盘画到过去」是定义本身，非 lookahead）。
 */
import { dispOf, type CountMode } from "./ichimokuParams";

/** 单根 K 线（t=开盘时间戳毫秒；只读入，引擎不改写） */
export interface OhlcBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** 引擎入参（countMode 决定位移，disp 经 dispOf 派生） */
export interface EngineParams {
  tenkan: number;
  kijun: number;
  senkouB: number;
  countMode: CountMode;
}

/** 引擎输出（全部与输入等长、下标对齐；未成窗处 NaN） */
export interface IchimokuSeries {
  n: number;
  tenkan: Float64Array;
  kijun: Float64Array;
  /** 原始未位移先行带（未来云/预判取用） */
  senkouA: Float64Array;
  senkouB: Float64Array;
  /** 位移对齐：dispA[i] = senkouA[i − disp]（i < disp 为 NaN，warmup 未成窗亦 NaN） */
  dispA: Float64Array;
  dispB: Float64Array;
  /** max/min(dispA, dispB)（Math.max/min 对 NaN 天然传染，同 Pine na 口径） */
  kumoTop: Float64Array;
  kumoBot: Float64Array;
  /** chikou[i] = close[i + disp]（延迟线画在过去；尾部 disp 根为 NaN） */
  chikou: Float64Array;
  /** = max(tenkan,kijun,senkouB)，头部未成窗根数（首个有效下标 warmup−1） */
  warmup: number;
}

/** 固定窗口滚动极值（单调队列 O(n)）：i < len−1 输出 NaN。
 *  isMax=true 取窗口最大，否则最小；队首即当前窗口极值下标。 */
function rollingExtreme(src: Float64Array, len: number, isMax: boolean): Float64Array {
  const n = src.length;
  const out = new Float64Array(n).fill(NaN);
  if (len <= 0 || n === 0) return out;
  const dq: number[] = []; // 候选下标，对应值保持单调（队首=窗口极值）
  for (let i = 0; i < n; i++) {
    const v = src[i];
    // 新值从队尾挤掉被支配的候选（等值也挤掉：保留最右下标，过期淘汰更省）
    while (dq.length && (isMax ? src[dq[dq.length - 1]] <= v : src[dq[dq.length - 1]] >= v)) {
      dq.pop();
    }
    dq.push(i);
    const winStart = i - len + 1;
    while (dq[0] < winStart) dq.shift(); // 队首滑出窗口
    if (i >= len - 1) out[i] = src[dq[0]];
  }
  return out;
}

/** Donchian 中轨：avg(highest(high,len), lowest(low,len))，i < len−1 为 NaN */
function donchian(h: Float64Array, l: Float64Array, len: number): Float64Array {
  const hi = rollingExtreme(h, len, true);
  const lo = rollingExtreme(l, len, false);
  const n = h.length;
  const out = new Float64Array(n).fill(NaN);
  for (let i = len - 1; i < n; i++) out[i] = (hi[i] + lo[i]) / 2;
  return out;
}

/** 计算一目均衡表全套序列（纯函数；bars 升序、不加仓不缓存、零副作用） */
export function computeIchimoku(bars: readonly OhlcBar[], p: EngineParams): IchimokuSeries {
  const n = bars.length;
  const h = new Float64Array(n);
  const l = new Float64Array(n);
  const c = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    h[i] = bars[i].h;
    l[i] = bars[i].l;
    c[i] = bars[i].c;
  }

  const tenkan = donchian(h, l, p.tenkan);
  const kijun = donchian(h, l, p.kijun);
  const senkouB = donchian(h, l, p.senkouB);

  // senkouA = avg(tenkan, kijun)（原始序列不位移；任一为 NaN 则 NaN）
  const senkouA = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) senkouA[i] = (tenkan[i] + kijun[i]) / 2;

  // 位移对齐（dispOf 单一真值源）：dispA[i] = senkouA[i − disp]
  const disp = dispOf(p, p.countMode);
  const dispA = new Float64Array(n).fill(NaN);
  const dispB = new Float64Array(n).fill(NaN);
  for (let i = disp; i < n; i++) {
    dispA[i] = senkouA[i - disp];
    dispB[i] = senkouB[i - disp];
  }

  const kumoTop = new Float64Array(n).fill(NaN);
  const kumoBot = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    kumoTop[i] = Math.max(dispA[i], dispB[i]); // 任一 NaN → NaN（同 Pine na）
    kumoBot[i] = Math.min(dispA[i], dispB[i]);
  }

  // 延迟线：第 i 槽存未来第 i+disp 根收盘（尾部 disp 根出界 → NaN）
  const chikou = new Float64Array(n).fill(NaN);
  for (let i = 0; i + disp < n; i++) chikou[i] = c[i + disp];

  const warmup = Math.max(p.tenkan, p.kijun, p.senkouB);
  return {
    n,
    tenkan,
    kijun,
    senkouA,
    senkouB,
    dispA,
    dispB,
    kumoTop,
    kumoBot,
    chikou,
    warmup,
  };
}
