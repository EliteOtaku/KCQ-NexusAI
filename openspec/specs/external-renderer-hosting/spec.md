# external-renderer-hosting Specification

## Purpose

外部宿主（嵌入式前端/插件 bundle）将 canvas 自绘图层接入 K 线的托管机制：
ChartController 级渲染器注册 API、渲染器插件类型公开导出、preview 工作台的
外部插件动态加载点。上游 PR #266。全部条目为通用机制，不含任何业务语义。

## Requirements

### Requirement: ChartController 渲染器插件注册

ChartController SHALL 暴露 `useRenderer(plugin, config?)` /
`removeRenderer(name)` / `getRenderer<T>(name)` / `scheduleDraw(level?)`，
透传核心 Chart 实例；幂等语义与 Chart.useRenderer 一致（按 plugin.name
保留首注册实例）。根导出 SHALL 包含 `RendererPlugin` /
`RendererPluginWithHost` 类型。

#### Scenario: 注册与幂等
- **WHEN** 同一插件对象经 useRenderer 注册两次
- **THEN** getRenderer 返回首注册实例，不抛错

#### Scenario: 数据到达触发重绘
- **WHEN** 插件经轮询/WS 取得新数据后调用 scheduleDraw()
- **THEN** 引擎执行一次全层重绘

### Requirement: preview 外部渲染器加载点

preview 工作台 SHALL 在 controller-ready 时加载宿主声明的渲染器插件模块：
声明通道为 `localStorage['kcq_external_renderers']`（JSON URL 数组）或查询
参数 `?externalRenderers=url1,url2`；模块契约支持 default/renderers/renderer
导出 RendererPlugin 或其数组，亦支持工厂形态
`(host: { controller }) => RendererPlugin | RendererPlugin[]`。相对路径
SHALL 归一为绝对 URL 后动态 import（dev 管线会重写相对路径动态导入进模块
图，public 资产不在图内而 404）。单模块失败 SHALL 仅告警，不影响工作台与
其它插件。

#### Scenario: 外部插件加载
- **WHEN** 访问 `?externalRenderers=<url>` 且模块 default 导出合法插件
- **THEN** 控制台输出注册日志，插件绘制出现在主图

#### Scenario: 工具契约随插件声明
- **WHEN** 插件工厂返回值携带 chartTools 数组或模块命名导出 chartTools
- **THEN** loader 收集并经 bridge 后补注册进 Agent 工具目录
  （见 external-agent-tool-hosting）
