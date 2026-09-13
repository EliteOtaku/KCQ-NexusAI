## 🔀 NexusAI Fork 说明

本仓库是 **KCQ-NexusAI**——由 [EliteOtaku](https://github.com/EliteOtaku) 维护的 [KLineChartQuant](https://github.com/363045841/KLineChartQuant) 公开 fork。图表引擎的全部功劳归上游作者，本 fork 只在其上增加：

- **NexusAI Shell**（`packages/nexus-shell`）：通用、与业务解耦的 TradingView 风格宿主壳（React + Vite）——顶栏 / 绘图工具条 / 指标管理面板 / 模板系统骨架 / 主题 token。MIT 随上游沿承，欢迎复用壳层。
- **引擎通用增强**：积累在 `nexus/main` 集成线，按小而聚焦的批次（`pr/*` 分支）回馈上游：Web Component 内置数据源注册、`4h` 周期、画完保持选中时序修复、TV 式绘图模板。

分支模型：`main` 只做 upstream 镜像（fast-forward）；`nexus/main` 为 fork 集成线。署名细节见 [NOTICE](./NOTICE)。
