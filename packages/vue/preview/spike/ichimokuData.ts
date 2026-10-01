/* 临时 spike，验证 upstream #283：本文件自我方闭源资产 kcq-plugins 原样复制，仅做上游兼容性适配（改动见各处 spike 标注），勿当生产代码。 */

/** 一目均衡表 HTF 槽数据层：只服务高周期槽（HTF slot）的 K 线拉取与缓存；
 *  主图序列由渲染层直接用宿主 RenderContext.data，不走本层。
 *  零运行时依赖：connector 请求体/envelope 字段为 fork 客户端镜像（仅声明
 *  本层消费的字段），不 import core。
 *
 *  ── 字段映射依据（2026-09-30 对 http://127.0.0.1:8090 实测 + fork 源码核对）──
 *  端点 = POST {base}/api/v1/market-data/bars（fork packages/core
 *  data/provider/protocol/httpTransport.ts fetchBars 实路；不存在 /api/v1/ln 通道）。
 *  请求体（fork mt5.test.ts 断言镜像）：sourceId:'mt5' /
 *  instrument:{ id:'mt5:<SYM>', symbol:'<SYM>', exchange:'MT5',
 *  providerRef:{symbol:'<SYM>'} } / period:<KLinePeriod 字面量直传> /
 *  adjustment:'none' / barAggregation:'original' / limit / beforeTimestamp?。
 *  成功 envelope：{data:{items:[{timestamp,open,high,low,close,volume,turnover}],
 *  olderData,instrumentId,period,adjustment,barAggregation,timezone:'UTC'},requestId}
 *  ——时间字段实名 timestamp（UTC 毫秒，bar 开盘时刻；items 升序，末根=形成中
 *  bar：实测 daily 末根 ts=当日 00:00Z 而墙钟才 02:55Z）。olderData∈
 *  available|exhausted|unknown（游标分页终止依据）。失败 envelope：V1 形为
 *  {error:{code,message},requestId}，但 FastAPI 422 校验错实测返回 {detail:[…]}
 *  ——本层一律按「非 2xx 或缺 data.items 即失败」处理，不细分错误形状。
 *  limit 单页上限 = 1000（connector app/routes.py MAX_BAR_LIMIT；实测 1001 →
 *  422、1000 → 满页）。base 缺省 http://127.0.0.1:8090（fork sourceRegistry
 *  mt5.defaultBaseUrl），localStorage['kcq_ichimoku_api_base'] 可覆盖。
 *  拉取失败：旧数据保留 + failed/staleSince 标记，绝不抛出打断调用方轮询。
 */
import type { OhlcBar } from "./ichimokuEngine";
import {
  dispOf,
  type CountMode,
  type IchimokuParams,
  type KlinePeriodKey,
} from "./ichimokuParams";

/** 数据源 ID（fork sourceRegistry.mt5.id；instrument.id 前缀同源） */
const SOURCE_ID = "mt5";
/** MT5 品种交易所标识（fork 品种目录 exchange 字段原样镜像） */
const MT5_EXCHANGE = "MT5";
/** 复权口径：MT5 原始价（fork mt5 品种 capabilities.adjustments 仅 'none'） */
const ADJUSTMENT = "none";
/** 聚合口径：保留上游原生周期边界（协议默认） */
const BAR_AGGREGATION = "original";
/** 缺省 connector 地址（fork sourceRegistry.mt5.defaultBaseUrl） */
const DEFAULT_API_BASE = "http://127.0.0.1:8090";
/** base 覆盖键 */
const API_BASE_KEY = "kcq_ichimoku_api_base";
/** connector 单页 limit 上限（app/routes.py MAX_BAR_LIMIT，实测一致） */
const MAX_PAGE_LIMIT = 1000;

/** 读 API base（localStorage 不可用时回退缺省地址） */
function getApiBase(): string {
  try {
    return localStorage.getItem(API_BASE_KEY) ?? DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

/** 周期秒表：monthly/quarterly/yearly 取「年÷12」平均口径（2628000 / 7884000 /
 *  31536000 秒），与宿主月界自然长度刻意不绑定（只做理论槽位推算用） */
export function periodSeconds(p: KlinePeriodKey): number {
  switch (p) {
    case "1min": return 60;
    case "5min": return 300;
    case "15min": return 900;
    case "30min": return 1800;
    case "60min": return 3600;
    case "4h": return 14400;
    case "daily": return 86400;
    case "weekly": return 604800;
    case "monthly": return 2_628_000;
    case "quarterly": return 7_884_000;
    case "yearly": return 31_536_000;
  }
}

/** 理论周期收线时刻 = 开盘 + 周期毫秒（Pine time_close 同口径；刻意不碰时区/
 *  休市——真实边界由 connector 对齐，本函数只做名义推算） */
export function nextCloseMs(barOpenMs: number, p: KlinePeriodKey): number {
  return barOpenMs + periodSeconds(p) * 1000;
}

/** HTF 深度需求 = warmup + 主视窗深度 + 1（Pine f_secSlice v2.12 capD 口径：
 *  capD = max(n, disp + chiN + pad) + 1，再垫 warmup = max(tenkan,kijun,senkouB)）
 *  cfg.n=槽视窗根数；cfg.chiN=延迟线回看根数；cfg.pad=云前看冗余根数 */
export function requiredDepth(
  cfg: { n: number; chiN: number; pad: number },
  p: IchimokuParams & { countMode: CountMode },
): number {
  const warmup = Math.max(p.tenkan, p.kijun, p.senkouB);
  return warmup + Math.max(cfg.n, dispOf(p, p.countMode) + cfg.chiN + cfg.pad) + 1;
}

/** connector K 线条目（协议 ProtocolKLineItem 的本层消费子集） */
interface ConnectorBarItem {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** connector bars 响应 data 载荷（本层消费子集） */
interface ConnectorBarSeries {
  items?: ConnectorBarItem[];
  olderData?: string;
}

/** 单页请求（内部用；网络/解包/契约失败抛出，由 refresh 统一兜底标记） */
async function fetchPage(
  symbol: string,
  period: KlinePeriodKey,
  limit: number,
  beforeTimestamp: number | undefined,
): Promise<ConnectorBarSeries> {
  const body = {
    sourceId: SOURCE_ID,
    instrument: {
      id: `${SOURCE_ID}:${symbol}`,
      symbol,
      exchange: MT5_EXCHANGE,
      providerRef: { symbol },
    },
    period,
    adjustment: ADJUSTMENT,
    barAggregation: BAR_AGGREGATION,
    limit,
    ...(beforeTimestamp === undefined ? {} : { beforeTimestamp }),
  };
  const res = await fetch(`${getApiBase()}/api/v1/market-data/bars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`bars ${res.status}`);
  const envelope = (await res.json().catch(() => undefined)) as
    | { data?: ConnectorBarSeries }
    | undefined;
  const data = envelope?.data;
  if (!data || !Array.isArray(data.items)) throw new Error("bars invalid envelope");
  return data;
}

/** 缓存条目：failed=最近一次 refresh 失败；staleSince=进入失败态的时刻
 *  （null=数据新鲜；失败后恢复成功即清零）。fetchedAt=0 表示从未拉到过数据 */
export interface BarCacheEntry {
  bars: OhlcBar[];
  fetchedAt: number;
  failed: boolean;
  staleSince: number | null;
}

/** HTF 槽 K 线缓存仓：key = `${sourceId}|${SYMBOL}|${period}|${adjustment}`，
 *  同周期两槽（如周线主槽+周线参考槽）共享同一 entry。 */
export class IchimokuBarStore {
  private readonly cache = new Map<string, BarCacheEntry>();
  /** 品种切换代际（clearAll 递增）：竞态防御——切换瞬间在途的旧品种响应不许落缓存 */
  private gen = 0;
  /** 同 key 在途 refresh 去重（并发调用共享同一 Promise，避免分页风暴） */
  private readonly inflight = new Map<string, Promise<void>>();

  /** 读缓存（未拉取过返回 null；失败且有旧数据返回旧 bars + 失败标记） */
  get(symbol: string, period: KlinePeriodKey): BarCacheEntry | null {
    return this.cache.get(IchimokuBarStore.key(symbol, period)) ?? null;
  }

  /** 拉取至 depth 根（超单页上限自动 beforeTimestamp 游标分页；主要月线槽触发）。
   *  失败：旧数据保留 + failed/staleSince 标记，不抛；品种已切换（gen 变）丢弃。 */
  async refresh(symbol: string, period: KlinePeriodKey, depth: number): Promise<void> {
    const key = IchimokuBarStore.key(symbol, period);
    const going = this.inflight.get(key);
    if (going) return going;
    const job = this.refreshInner(symbol, period, Math.max(1, depth), key).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, job);
    return job;
  }

  private async refreshInner(
    symbol: string,
    period: KlinePeriodKey,
    depth: number,
    key: string,
  ): Promise<void> {
    const startGen = this.gen;
    const collected: OhlcBar[] = [];
    try {
      let cursor: number | undefined;
      while (collected.length < depth) {
        const limit = Math.min(MAX_PAGE_LIMIT, depth - collected.length);
        const series = await fetchPage(symbol, period, limit, cursor);
        const items = series.items ?? [];
        if (items.length === 0) break;
        for (const it of items) {
          collected.push({ t: it.timestamp, o: it.open, h: it.high, l: it.low, c: it.close });
        }
        if (series.olderData === "exhausted") break; // 终端历史见底
        const oldest = items[0].timestamp; // items 升序，页首=最旧
        if (items.length < limit || cursor === oldest) break; // 短页/游标未推进：防御死循环
        cursor = oldest; // 排他游标：下一页取严格更旧的 bars
      }
    } catch {
      this.markFailed(key, startGen);
      return;
    }
    if (this.gen !== startGen) return; // 期间发生 clearAll（品种切换）：丢弃过期响应
    this.cache.set(key, { bars: collected, fetchedAt: Date.now(), failed: false, staleSince: null });
  }

  /** 失败标记：有旧数据保留旧 bars（staleSince 只记首次进入失败态）；
   *  从未拉到过则落空 bars 条目（fetchedAt=0），让调用方能感知失败态 */
  private markFailed(key: string, startGen: number): void {
    if (this.gen !== startGen) return;
    const prev = this.cache.get(key);
    if (prev) {
      this.cache.set(key, {
        ...prev,
        failed: true,
        staleSince: prev.staleSince ?? Date.now(),
      });
    } else {
      this.cache.set(key, { bars: [], fetchedAt: 0, failed: true, staleSince: Date.now() });
    }
  }

  /** 清空全部缓存（品种切换时调用；代际 +1 使在途响应失效） */
  clearAll(): void {
    this.gen++;
    this.cache.clear();
  }

  private static key(symbol: string, period: KlinePeriodKey): string {
    return `${SOURCE_ID}|${symbol}|${period}|${ADJUSTMENT}`;
  }
}
