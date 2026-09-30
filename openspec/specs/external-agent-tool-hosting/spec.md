# external-agent-tool-hosting Specification

## Purpose

外部宿主持有的 `@Tool` 领域方法接入 Agent 运行时的托管机制：工具归属解析、
编程式工具注册、bridge 工具目录的后补注册。上游 PR #274（替代早期 #272）。
全部条目为通用机制，不含任何业务语义。

## Requirements

### Requirement: ChartController 工具宿主注册

ChartController SHALL 暴露 `registerToolHost(host)` /
`unregisterToolHost(host)`：宿主的 `@Tool` 标注方法经方法函数身份（owns）
在已注册宿主中解析执行目标。注册 SHALL 幂等（同一宿主重复注册仅保留一份）。
`ChartAgentControllerDependencies` SHALL 支持可选 `extraToolHosts` 惰性源。

#### Scenario: 宿主方法归属解析
- **WHEN** 宿主经 registerToolHost 注册且其 @Tool 方法被调用
- **THEN** chartToolTarget 按 owns 解析到该宿主执行

### Requirement: 编程式工具注册

工具注册表 SHALL 提供 `registerChartTool(tool)` /
`unregisterChartTool(name)`：外部宿主 bundle 与 Core 不共享模块实例、类装饰
器不可达时，经本入口写入唯一真源；同名重复注册抛错（与装饰器语义一致）。
根导出 SHALL 包含 `Tool` 装饰器与工具协议类型。

#### Scenario: 外部 bundle 注册
- **WHEN** 外部模块持有 RegisteredChartTool 结构登记并调用 registerChartTool
- **THEN** getRegisteredChartTools 包含该工具

### Requirement: bridge 外部工具源与后补注册

BrowserToolRegistry SHALL 接受 `extraChartTools` 惰性源（构造时求值合并），
并 SHALL 提供公开 `registerChartTools(tools)` 后补注册（check 判重跳同名，
不抛错）；BrowserAgentBridge SHALL 暴露 `registerExternalChartTools(tools)`
透传——外部插件晚于 bridge 加载时（构造时快照错过），宿主收集到工具后调用
即进入后续会话的可用目录。

#### Scenario: 晚加载插件后补注册
- **WHEN** bridge 先构造（extraChartTools 为空）后插件加载并调用
  registerExternalChartTools
- **THEN** 后续会话的工具目录包含该工具，check 命中且可执行
