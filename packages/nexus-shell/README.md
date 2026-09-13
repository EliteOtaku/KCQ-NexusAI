# NexusAI Shell

NexusAI Shell 是 [KCQ-NexusAI](https://github.com/EliteOtaku/KCQ-NexusAI) fork 自带的通用 TradingView 风格宿主壳（React + Vite），定位为**与业务解耦**的壳层脚手架：

- 顶栏（品种/周期/主题切换）
- 左侧绘图工具条
- 指标管理面板
- 模板系统骨架（消费 `DrawingTemplateStore` 端口，存储实现可注入）
- 主题 token（CSS 变量，亮/暗双主题，颜色只在 `src/styles/tokens.css` 定义）

## 边界

壳只做通用 UI 与端口定义，**不包含任何业务图表内容**（策略 overlay、业务数据接口等由各宿主自行接线）。图表引擎经 `@363045841yyt/klinechart-react` 适配器挂载。

## 开发

```bash
pnpm install
pnpm --filter nexus-shell dev     # 开发服务器
pnpm --filter nexus-shell typecheck
```

## 路线（骨架 → 可用）

1. 数据接线：宿主 datafeed / 内置数据源注册（复用 fork 的 WC 入口补丁）
2. 绘图工具条接引擎 controller（工具选中 → `setDrawingToolId`）
3. 指标面板接引擎指标注册表（真实增删/参数）
4. 模板存储默认实现（localStorage）与套用/保存闭环
