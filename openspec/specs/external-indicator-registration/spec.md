# external-indicator-registration Specification

## Purpose

外部宿主的指标定义接入指标目录的托管机制：编程式注册入口与外部指标 UI 元
数据通道。上游 PR #273。全部条目为通用机制，不含任何业务语义。

## Requirements

### Requirement: 编程式指标定义注册

指标定义注册表 SHALL 提供 `registerIndicatorDefinition(config,
rendererFactory)`：与 `@Indicator` 类装饰器共享同一条写入路径（组装语义一
致）；同名重复注册 SHALL 抛错。config.name SHALL 放宽为 string（契约 union
仅约束内置指标的编译期拼写，运行时注册表无此约束）。注册表导出与根导出
SHALL 包含该入口及 `IndicatorDefinitionConfig` 类型。

#### Scenario: 外部定义进入目录
- **WHEN** 外部宿主持有 rendererFactory 并调用 registerIndicatorDefinition
- **THEN** getRegisteredIndicatorDefinitions 与 allIndicators 均包含该定义
  （catalog 身份 = displayName）

#### Scenario: 同名重复注册
- **WHEN** 相同 name 再次注册
- **THEN** 抛错，注册表保持原定义

### Requirement: 外部指标 UI 元数据通道

`IndicatorDefinitionConfig` 与 `IndicatorMetadata` SHALL 支持可选
`ui?: { name?, description?, params? }`；catalog rebuild 的 UI 元数据解析
SHALL 为 `uiMeta[key] ?? def.ui`——内置指标路径零改动，外部指标的参数面板
元数据随定义携带。

#### Scenario: 外部定义携带参数面板
- **WHEN** 外部定义声明 ui.params
- **THEN** allIndicators 映射结果的 params 与其一致，可供指标选择器与
  参数面板使用
