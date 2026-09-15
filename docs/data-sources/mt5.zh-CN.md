# MT5（`MT5-Connecter`，Exness 本地终端）

## 简介

MT5 数据源读取本机已登录的 MetaTrader 5 终端（Exness 账户）的 K 线与品种目录，并经 SSE 推送实时帧。后端为同级仓库 `MT5-Connecter`（Python + FastAPI + MetaTrader5 包 IPC），实现本仓 market-data V1 协议（probe / instruments/search / bars）+ 实时流端点。

本地仓库与 `MT5-Connecter` 保持同级目录：

```
workspace/
├── KCQ-NexusAI/        # 本仓库
└── MT5-Connecter/      # MT5 数据后端（:8090）
```

> GitHub 仓库地址为占位（`https://github.com/363045841/MT5-Connecter`），发布前 `pnpm setup` 的克隆步骤不可用；可先手动放置本地仓库到同级目录。

## 使用方法

- 数据源 id：`mt5`（注册于 `packages/core/src/data/provider/sourceRegistry.ts`）
- 默认地址：`http://127.0.0.1:8090`
- 支持周期：`1min` / `5min` / `15min` / `30min` / `60min` / `4h` / `daily` / `weekly` / `monthly`
- 复权：仅 `none`（外汇/CFD 无复权概念）
- 能力声明：仅 bars + SSE 实时流（无 timeshare / depth）
- 品种会话：`MT5`（7x24，UTC 时区，供时区解析，不裁剪 K 线）
- nexus-shell：设置 → 数据源 → MT5（切换时探测连接器可达性，失败保持 Mock 并提示）；品种搜索走跨源 `searchInstruments`

## 启动方式

前置：Windows + 已安装并登录的 MT5 终端（Exness）+ Python 3.12 + [uv](https://docs.astral.sh/uv/)。

```bash
# 在本仓库根目录执行（等价于 cd ../MT5-Connecter && uv run python ./server.py）
pnpm connecter mt5

# 或在 MT5-Connecter 目录手动启动
cd ../MT5-Connecter
uv sync
uv run python ./server.py
```

连接器初始化时校验终端平台（company/server 含 `exness`）与登录状态；校验失败时 probe 如实上报 offline，REST 数据端点返回 502。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MT5_TERMINAL_PATH` | 自动探测 | 终端 `terminal64.exe` 全路径（如 `C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe`）；不裸调 initialize，避免连错终端 |
| `EXNESS_ONLY` | `1` | 仅允许 Exness 平台；`0` 放开（开发/测试） |
| `ALIGN_TZ` | `auto` | 对齐模式：`auto`=检测到 Exness 才对齐 / `gmt2` / `gmt3`（固定锚）/ `off`（取 MT5 原生周期数据） |
| `EXNESS_SERVER_UTC_OFFSET` | 实测 | 服务器 UTC 偏移覆盖（小时）；缺省用最后 tick 时间实测（模 24h 归一 ±12h） |
| `MT5_PORT` | `8090` | HTTP 端口 |

## 时区对齐语义（Exness）

MT5 的时间戳是「服务器墙钟按 UTC epoch 解释」的伪 UTC。连接器职责：

1. **偏移校正**：所有周期输出前先实测服务器偏移并换算成真 UTC（`EXNESS_SERVER_UTC_OFFSET` 可覆盖）。
2. **周日短棒不剔除**（决策 D15）：日内周期（1m–1h）原生序列偏移校正后保留；周日走势段完整呈现在图表上。
3. **高周期锚时区重采样**（对齐开启时）：4h/日线自 H1、周/月自 D1 重采样——加密品种锚 UTC（币安标准边界），传统品种（外汇/金属/指数）锚 Europe/Athens（EET/EEST 自动 DST）。周日短棒在该重采样中自然并入周一首根。
4. **probe 上报**：`alignment.enabled` / `serverOffsetMinutes` / 锚描述，宿主可见对齐状态。

设计依据见 `docs/design/mt5-exness-alignment.md`。

## 实时链路（SSE）

- 端点：`GET /api/v1/market-data/sources/mt5/stream?symbol=XAUUSD&period=4h`
- 单连接固定订阅一个 (symbol, period)；切品种 = 断开重连
- 帧类型：`snapshot`（订阅建立时的尾部快照）/ `forming`（当前根更新）/ `closed`（收线终值，容忍终端缓存滞后修订）/ `status`（行情开闭/连接降级）
- 断线重连：EventSource 原生重连 + `Last-Event-ID` 环形缓冲补帧（每流 500 帧）
- 心跳：15s `: keepalive` 注释帧
- core 消费端：`Mt5LiveSource`（EventSource 封装）+ `RealtimeBarsConnector`（帧驱动 `controller.updateBars`，closed+forming 合并为一次原子写）
