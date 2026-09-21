# Current Work Log

## 2026-09-18（端口混乱排查：MT5 不可见根因与端口约定）

- 现象: 用户访问 5173/?view=kcq 强制刷新后仍看不到 MT5
- 根因: 5173 被 **KCQ preview 旧 dev 进程**（merge 前启动）占用——用户访问 5173 的任意 query（含 ?view=kcq）都命中该旧进程服务的 preview 首页（旧模块缓存），MT5 不可见；cloudtradeagent WebUI 的 vite 写死 port 5173，后启动只能挪走。webui 前端实际没有 view=kcq 视图（App.tsx 只认 view=options）
- 处置: 杀旧进程；preview/vite.config.ts 固定 server.port=5175 + strictPort（5173 还给 WebUI）；5175 实测聚合源列表 = BaoStock/FinShare/GOTDX/TradingView/MT5 (Exness)/Mock ✓（连接器未跑时 MT5 显示"离线·原因"）
- 端口约定: **5173=cloudtradeagent WebUI / 5175=KCQ Vue preview（strictPort）/ 5273=nexus-shell / 8090=MT5-Connecter**

## 2026-09-18（第二会话·提交推送 + 上游 PR #197 + TV 对齐拍板）

- 提交推送: nexus/main 4 commits（数据源管理统一化 3275d7c6 / vue probe message 透传 5f31c8cb / preview 端口+connector 拼法 9e519b3c / handoff 209f56dc）push origin；连接器仓 probe message commit 5c796de push
- 上游 PR #197（363045841/KLineChartQuant）: 分支 pr/mt5-source 基于 upstream/main（已前进至 e4b6fdfe，import 全面 .js 后缀化）cherry-pick 4 commits（updateBars/mt5 provider+live/测试修复/vue message），冲突两处（dataBuffer.ts、data/index.ts——均按上游 .js 风格手工合并）；controllers/index.ts 补 mt5/searchInstruments 导出（.js 风格）；PR 分支全量 core 测试 223 文件/2519 绿；PR 说明 temp/pr-mt5-source.md
- TV 对齐拍板（用户）: ①浏览器方案采纳（Edge 采集 TV 网页版参考，替代手动截图；红线：不登录/限速/不拷资产）②新短板登记：**KCQ 光标不能越过最新 K 线右缘**（TV 可自由右移并显示外推时间/价格）——列入 T1 ③多布局上限三分屏、每格独立品种 ④任务拆分：闲时 C（参考采集）→用户复核→闲时 D（T1 实施）

## 2026-09-18（第三会话·提示词 C 执行：TV 界面参考采集）

- Objective: 提示词 C——浏览器采集 TV 网页版界面参考（免费未登录、中文），产出 temp/tv-reference/ 三件套
- 执行差异: 指定的 Edge 通道环境不可用（browser-use 仅 ZCode IAB，Chromium 隔离未登录 profile，满足 R1）；
  语言切换：?lang=zh / setlang cookie 均不改图表应用语言 → 主页 hreflang 确认 cn.tradingview.com（zh-cn）直连
- 交互方案沉淀: TV 应用对合成指针事件选择性响应——顶栏按钮/对话框/tab 接受"完整 pointer 事件序列派发"
  （pointerdown→mousedown→pointerup→mouseup→click，React 根监听冒泡），且**每次整页刷新后首击必中**；
  连续交互后左工具栏按钮/flyout 失效；右键菜单需可信事件（CUA 报 Unsupported mouse button: right）；
  匿名推广浮层（gopro dialog，全屏 pointer-events:auto 拦截、无关闭钮、Escape 不散）周期弹出，刷新重置规避。
  顶栏按钮有稳定 id（header-toolbar-symbol-search/-compare/-alerts/-replay/-layouts/-properties/-fullscreen 等）
  且 DOM 存在三份断点模板拷贝——定位须做 elementFromPoint 可见性过滤
- 采集结果: 12 项界面全覆盖，33 张截图（29 张有效 + 4 张实为推广浮层已在 notes.md 标注）；
  notes.md（结构+控件文字清单+布局层次）；gap-analysis.md（TV↔KCQ↔批次归属，T1 六域全落地，
  4 项标"需引擎扩展"：priceScale 对数/百分比、drawing 撤销重做栈、时间范围条解析、右缘空白 viewport+timeAxis 外推）
- 受限项: 图表空白处右键菜单（技术）、几何/注释/图标三组 flyout 明细（技术）、告警创建+回放控制条（账号墙，
  入口/升级文案已采）、3+ 格布局实际选择（未点击验证）——均建议用户人工补图
- 验收门: 4/4 过（≥10 界面截图可读 / notes 12 项全覆盖 / gap 覆盖 T1 全部范围域 / 未登录+零业务代码改动+零提交）
- 页面量: 约 11 次加载（R2 <30 ✓）；R3 无资产拷贝（仅截图与控件文字清单）；temp/ 已 gitignore

## 2026-09-18（第四会话·用户补图右键菜单 + H 批拍板）

- 用户补图: TV 图表空白处右键菜单（登录态 XAUUSD）——14 项 5 组：重置视图(Alt+R)/复制价格格·粘贴(Ctrl+V)/
  以价添加警报(Alt+A)+交易三项(登录态专属，不采)/按时间锁定垂直光标线/表格视图·对象树·图表模板▸/
  移除N个绘图·N个指标(动态计数)/设置...——已整理进 notes.md [4a]
- KCQ 现状核实（回应用户"水平线没有属性"）: Flybar 有 8 样式键（DrawingDocument.ts DRAWING_STYLE_KEYS:
  stroke/strokeWidth/strokeStyle/fill/fillOpacity/pointRadius/textColor/fontSize，getBatchStyleKeys 批量交集）；
  真缺口=params 参数编辑（DrawingObject.params 泛型存在但无 schema 无 UI）、图元设置对话框（TV 三 tab）、
  可见性按周期、复制/粘贴价格格、克隆、延展 extend
- H 批拍板（用户）: "先补上 TV 的右键菜单，然后各组件控件属性、模板管理补课"——登记 backlog，插 T1 后 T2+ 前；
  gap-analysis 新增 H 域（范围建议：①图元设置对话框框架 ②params schema+编辑（水平线价格/fib levels 打样）
  ③图元菜单扩项 ④空白菜单扩项 ⑤extend 引擎支持；①②③主）
- 文档更新: notes.md [4]（[4a] 已采+[4b] 待补清单：图元右键菜单/图元属性对话框/fib 输入tab/通道延展）；
  gap-analysis.md G 域右键菜单两行改 H 批+新增 H 域+T1 统计补批次顺序；backlog H 批条目

## 2026-09-18（第五会话·用户补图图元右键菜单：模板子菜单基准）

- 用户补图: TV 图元右键菜单（登录态，命中水平射线）——主菜单 11 项 4 组：为水平射线添加警报(Alt+A，按 kind
  动态)/模板▸·视觉顺序▸·时间周期可见性▸·对象...▸/克隆(Ctrl+Drag)·复制(Ctrl+C)/锁定·隐藏·移除(Del)/设置...
- 核心增量=模板子菜单展开态: 保存为.../应用默认/<当前模板名+垃圾桶快速删除>/<已存模板点击即应用>
  （用户自建 10 个水平线模板：上/下/注意/LQ/LQ H1/LQ used/OB/POC/SR/TP——交易关键位场景每模板存不同样式）
- 用户观点: TV 模板"快速调用+快速删除"比 KCQ 成熟——核实：KCQ 有 per-kind 模板引擎（TemplatePanel
  保存/套用/重命名/删除/自动套用 + Flybar 模板按钮，listTemplates 按 kind 过滤），缺的只是入口形态：
  无右键子菜单调用、无"应用默认"、无子菜单内垃圾桶删除——H 批为纯壳层接线，不涉引擎
- 同帧另获: TV 选中图元浮动条（样式/文本/线宽/设置/删除——对应 KCQ Flybar 形态参照）
- 文档更新: 04b-drawing-context-menu.png 归档；notes.md [4b] 改已采（仍待补：设置...后属性对话框 tab）；
  gap-analysis H 域图元菜单行/模板快速调用行/视觉顺序行；backlog H 批条目重排为 6 项（模板子菜单单列④）

## 2026-09-18（第六会话·用户补图 fib 属性对话框：params 基准闭环）

- 用户补图: TV 斐波那契回撤属性对话框"样式"tab 全录（04c-fib-settings-dialog.png）——
  骨架=kind 名标题+图钉/三 tab（样式/坐标/可见范围）/底部"模板∨"下拉+取消确认
- 关键认知修正: TV 的 params 编辑（levels 档位表）在**样式 tab**内（每行 ☑显隐+数值可编辑 spinner+独立颜色，
  "使用一种颜色"开关统一覆盖；档位数值本身是可增改删的参数非固定枚举）——"坐标"tab 是锚点时间/价格数值编辑
  （水平线价格在此），此前推测的"输入 tab"命名不存在
- T1 关联: "基于对数坐标的Fib水平 ☑"——fib 档位与坐标缩放联动，H 批此项前置=T1 priceScale 对数模式
- TV 模板第 4 入口: 属性对话框底部"模板∨"（此前已录右键菜单子菜单/Flybar/工具栏）
- 文档更新: notes.md [4c] 全结构入库；gap-analysis H 域重排（对话框行/params 行/坐标 tab 行/可见范围行/
  模板第4入口行/对数联动行，tab 命名修正）；backlog H 批条目同步
- 待补（可选收尾）: 坐标 tab / 可见范围 tab / 水平线属性对话框截图——H 批打样"水平线价格编辑"时参考

## 2026-09-18（第七会话·第二轮深挖：根因推翻与 flyout 补全）

- 用户批评"调查范围太粗，细节应自动挨个列出"——触发重新上机排查
- **根因推翻 1**：首轮"连续交互后失效"真凶=匿名推广浮层（gopro，全屏 container 拦截、elementFromPoint 证实按钮被盖）。
  解法：注入 MutationObserver 自动 remove 浮层节点 → 合成事件交互全面恢复（__tvClick 完整 pointer 序列可复用）。
  pointerId 污染假说被证伪。
- **根因推翻 2**：绘图工具激活失败真凶=**TV 匿名态绘图功能整体锁定**（点击任意绘图工具弹"为您的分析解锁所有绘图"
  升级墙），画线/图元/图元菜单/图元属性对话框在匿名态不存在——非技术问题，用户登录态截图是唯一合法基准（R1）。
  flyout 打开不受绘图锁限制（纯 UI 展示），8 组全部采齐：
  - 几何形状：笔刷/荧光笔 | 箭头标记/箭头/向上箭头/向下箭头 | 矩形/旋转矩形/路径/圆/椭圆/折线/三角形/弧形/曲线/双曲线
  - 注释工具：文字/笔记/价格笔记/置顶 | 表格/标注/评论/价格标签/指示牌/旗标/图片/帖子/观点
  - 图标：三 tab 网格（表情符号/贴纸/图标）——结构不同，图标本体无 ARIA 名
- 新增采集：前往到弹层（日期/自定义范围双 tab+月历）；验证匿名锁定：指标模板/管理布局菜单点击无响应（空实现）
- 右键自动化终验关闭：合成 contextmenu + 可信键盘 Menu/Shift+F10 均无法在图表区触发（手势层要求可信 button-2 序列）
- 产出更新：02-flyout-{geometric,annotation,icons}.png 补拍成功（截图库 36 张全有效）；
  notes.md 执行差异 ③④ 重写、[2] 节 8 组全录、[9] 前往到、新增"附 A 匿名态锁定域清单"（D/H 提示词边界）
- 页面量：本轮仅 1 次加载（全程单页交互+observer），两轮合计约 13 次 < 30 ✓

## 2026-09-18（第八会话·用户补图：滚动到最近K线按钮）

- 用户补图: "滚动到最近的K线"悬浮按钮（登录态 BTCUSD，09d-scroll-to-latest.png）——hover 价格轴浮现的
  »按钮，Tooltip"滚动到最近的K线 Alt+Shift+→"，点击右缘对齐最新 K 线；按钮下方小 ∨ 疑为自动滚动选项（待确认）
- 首轮遗漏确认: [9] 只采了底部条静态项，漏了此 hover 按钮——已入库 notes.md [9d]
- 归属: T1 E 域（右缘空白扩展）补一行——与右缘空白是同对功能（拖历史区浏览+一键回实时回路）；
  引擎实现面小（viewport rightOffset 置空白色值），归 T1 同批
- 文档: notes.md [9d]、gap-analysis E 域新增行

## 2026-09-18（第九会话·用户补图：A/L 轴快捷钮 + 滚动按钮特写澄清）

- 用户澄清: [9d] 滚动按钮旁的小 ∨ 只是悬浮说明指示箭头（非下拉）——特写图 09d2 确认按钮组实为
  **⊕ 加号钮**（快捷加警报/订单，即图表属性"加号按钮"开关对应物）+ **» 滚动到最近K线钮**并排
- 用户补图: **价格轴 hover 快捷钮 A/L**（09e）——hover 轴下端浮现，A=自动比例、L=对数坐标，一键切换；
  用户明确反馈"KCQ 对数坐标埋太深"→ T1 对数/自动模式必须含轴上快捷钮形态（与设置对话框坐标模式下拉同态双入口）
- 首轮对照: 03c 采集时曾在坐标枚举中记录过"切换自动坐标/切换对数坐标"按钮文字，但未展开形态与交互细节——本轮升级
- 文档: notes.md [9d] 修正+[9e] 新增；gap-analysis B 域 A/L 行重写（含用户反馈依据）

## 2026-09-18（第十会话·用户补图：设置对话框模板下拉展开态）

- 用户问"设置页面 tab 逻辑、模板管理是否有记录"——核对：tab 逻辑已有（[3] 7 tab 全录，本轮补"每 tab
  带图标+选中高亮"视觉细节）；模板下拉此前只记入口未记展开内容——本轮补全
- 用户补图: 设置对话框"模板^"下拉展开态（03h-settings-template-dropdown.png）——应用默认/保存为.../
  模板列表（日期自动命名 2023-05-27 等 + 自定义名 Black/BRG/G/Grey/JL/footprint 混合，可滚动）
- 域澄清: 图表模板（整图快照，双入口=空白菜单"图表模板▸"+设置对话框底部"模板∨"）≠ 绘图模板（[4b] per-kind
  样式子菜单，含垃圾桶快速删除）≠ 指标模板——三者交互同构（应用默认/保存为/列表）但域不同
- 文档: notes.md [3] tab 细节 + [3h] 新增；gap-analysis H 域图表模板行补交互基准引用

## 2026-09-18（第十一会话·用户补图：模板列表 hover 删除 + 统一范式拍板）

- 用户补图: 模板列表项 hover 垃圾桶快速删除（03i-template-remove-hover.png，hover "JL" 出垃圾桶+"移除"tooltip）
  ——修正 [3h] 上轮"删除应在管理器内"的推测：图表模板列表项同样支持 hover 一键移除
- **统一范式拍板（用户）**："其他绘图组件的模板管理逻辑和这个是一样的，完全可以照搬"——TV 三种模板域
  （图表/绘图/指标）同一套交互：应用默认+保存为...+列表（点击应用/hover 垃圾桶删除）
- H 批实施约束更新（gap-analysis H 域新增行）：做一套可复用模板管理组件，三处入口
  （右键子菜单/对话框底部下拉/面板）仅换数据域；KCQ 现状是能力分散无统一范式
- 文档: notes.md [3i] 新增；gap-analysis H 域两行

## 2026-09-18（第十二会话·提示词 D 撰写 + 交接就绪）

- 用户确认工作模式：交接文档先行 → 提示词自包含（开头 /agent-handoff 恢复上下文）→ 执行后 /agent-handoff 收尾
- 提示词 D 写入 AGENT_SESSION_PROMPTS.md（T1 实施=五块重做+撤销重做+三项引擎扩展）：
  结构 0-7（身份/已查证事实/用户决策/铁律 R1-R7/9 阶段范围/明确不做/验收门/收尾）+ 反空转条款
  - 三项引擎扩展定稿：priceScale log/percent/auto、viewport trailing+timeAxis 外推+命中延伸、
    drawing 撤销栈（DrawingDocument 原语之上 command 包装，禁改原语语义）——时间范围条解析归壳层阶段 6
  - 设计文档先行要求：docs/design/t1-{priceScale-modes,viewport-trailing,drawing-undo-redo}.md
  - 阶段门+单 commit <800 行+一项一 commit（AGENTS.md 大 PR 红线）；验收门含基线：core 2519/
    root type-check 52 存量（新增 0）/三探针 39-15-49/probe-mt5 10
  - 提交授权：全部阶段过门后 merge nexus/main + push（中途不 push）
- 交接同步：snapshot 切"执行提示词 D"（含 T1 范围速览/Recovery 摘要）、backlog TV 条目更新（D 就绪待执行）、
  AGENT_HANDOFF.md 日期、提示词 C 状态行更新为复核通过
- 下游待写：H 批提示词（D 完成复核后；基准与范围建议已在 gap-analysis H 域 + backlog H 批条目）

## 2026-09-18（第十三会话·计划转向：T1 改开发组实施，需求单产出）

- 用户与 KCQ 开发组沟通结果：T1 改为"需求单+截图交给开发组实施"；开发组即将推送新代码到主分支
- 需求单产出: temp/tv-reference/T1-requirements.md——A 撤重做（引擎+壳）/B 坐标三模式+A/L 轴钮（引擎+壳）/
  C 右缘空白（引擎）/D 滚动到最近K线钮/E 底部范围条/F 大设置四 tab/G 顶栏形态/H 三分屏，
  每条含 TV 行为+截图引用+验收标准+引擎/壳标注；复刻边界声明（结构/交互照搬，CSS/SVG 不拷）；
  I 节预告 H 批（基准已就绪可随时出第二批）
- **提示词 D 状态：挂起**——若开发组实施覆盖 T1 则作废；若只做部分（尤其引擎侧），壳侧剩余仍可按 D 执行
- 交接提醒: 开发组推送主分支后 nexus/main 需同步 upstream/main（backlog 既有条目），同步后重估
  T1 剩余范围（gap-analysis 逐条比对新代码），再定需求单缺口/提示词 D 是否部分恢复

## 2026-09-18（第十四会话·上游同步 #202 + agent 面板需求登记）

- 同步：upstream/main e4b6fdfe→25c31e3c（24+ 提交，大头 #202 drawing-drag-policy：锚点视觉统一/通道拖拽策略/
  中点手柄/locked 语义修订为"可选中不可拖"/Babel 8/Vite 8.3/biome 替代 eslint+prettier 工具链）
- 合并冲突 23 文件：drawing 域+设计文档+测试取上游（fork 内容已随 #174 进上游，上游为演进超集）；
  **MT5 链路手工保留**（controllers/index.ts 补 searchInstruments+mt5 导出、data/index.ts 补 mt5 provider/live、
  dataBuffer.ts 补 UpdateBarsResult+updateBars 方法、package.json 补 connector 脚本+playwright-core）；
  vue 两文件并集（DrawingStyleToolbar：fork 模板 emits+上游 toggleLock；KLineChart：上游 .js imports+fork useDrawingTemplates）
- 验证：pnpm install（biome 包网络超时，fetch-timeout 600000 解决）；build:packages 过（dataBuffer import 修复后）；
  core vitest **2591/2591 绿**（基线上涨）；nexus-shell typecheck 绿；5273 已起（Vite 8.3.0）
- 探针：probe-topbar 15/15 ✓；**probe-drawing 38/39（B1-04 三锚点通道创建 FAIL——上游改通道右端点光标驱动）；
  probe-b234 B3-03 显隐切换 FAIL+首轮超时**——均为 #202 预期影响，探针/壳侧适配列为待办（backlog）
- 新需求登记：agent 弹出式可伸缩浮动面板（静默收合成按钮/横条、可任意拖放、点击展开、尺寸可调+本地持久化）
  ——backlog 新条目 + 需求单新增 J 节
- merge commit 5425e24a 已 push origin；handoff 文件改动未提交（等待用户决定）

## 2026-09-19（探针修复 + 双 issue 预览稿）

- 探针修复（上游 #202 适配，两探针恢复全绿：39/39、50/50、15/15）：
  - probe-drawing B1-04：anchors.length 3→4（#202 composite anchors 全量持久化：平行通道落库两线各 2 端点）
  - probe-b234 B3-03：流程改为解锁→隐藏→显示→锁定→解锁→删除（上游 locked 门控：锁定图元只接受 locked 字段）
  - b234 新增一条断言：显隐恢复（visible=true）
- **B3-03 根因定性**：上游 locked 语义修订把 visible 归入 hasEditablePatchFields（DrawingDocument.ts L142-150/
  L218/L335-338）——锁定图元 visible patch 被拒。与 TV 基准冲突（TV 锁定图元眼睛开关可用）→ 构成 issue 素材
- debug 脚本 scripts/_debug-probes.mjs 用完即删；复刻 probe-b234 流程定位（锁定态点隐藏 visible 不变 + 引擎
  updateBatch visible patch 被拒 + "显示"按钮不存在的 30s 超时 crash 链）
- issue 预览稿产出 temp/issue-drafts/README.md：①locked 门控 visible（含根因定位/TV 冲突/豁免建议/discussion 标签）
  ②agent 面板收起右上/展开右下按钮分居对角线（用户 UX 反馈+三档改进提案：就近原则/可伸缩浮层/快捷键）；
  截图 agent-panel-{expanded,collapsed}.png 已归档，GitHub 提交时需手动上传
- 待用户审阅 issue 预览后提交上游

## 2026-09-19（第二会话·issue 提交受阻于 token 权限 + TV 需求 issue 预览）

- agent 面板需求（用户拍板）已在上一会话登记（需求单 J 节 + backlog）
- 用户确认先提 2 个 issue（locked 门控 visible / agent 面板按钮位置）→ gh issue create 失败：
  **GH_TOKEN（fine-grained PAT）无 issues:write 权限**（GraphQL createIssue Resource not accessible）
- 应对：两个 issue body 已就绪（temp/issue-drafts/bodies/issue{1,2}-body.md）；
  issue 2 截图托管于 fork 仓 issue-assets 分支（agent-panel + 6 张 T1 基准图，raw URL 嵌入可渲染）
- TV 复刻需求 issue 预览稿产出：temp/issue-drafts/tv-replica-issue-preview.md（标题/正文/body 文件
  bodies/tv-replica-body.md，A-H 八节+后续预告，6 张关键截图 raw 嵌入）——**待用户审阅后再提**
- 提交通道二选一：a) 用户更新 GH_TOKEN 加 issues:write 后由代理重提 b) 用户手动提（body 文件直接粘贴，
  issue 2 图片已在 assets 分支 raw 链接自动渲染，无需上传）

## 2026-09-19（第三会话·三 issue 提交成功）

- 提交结果（363045841/KLineChartQuant）：
  - #205 = locked 门控 visible（bug，根因定位 DrawingDocument.ts hasEditablePatchFields）
  - #206 = agent 面板收起/展开按钮分居对角线（ux，含用户可伸缩浮层提案+两档过渡方案）
  - #207 = TV 对齐需求清单（A 撤重做/B 坐标三模式+A-L 轴钮/C 右缘空白/D 滚动钮/E 底部范围条/
    F 大设置/G 顶栏/H 三分屏/I 图元属性+params/J 模板统一范式/K 右键菜单扩项/L 告警回放类型接线
    + 后续预告：数据窗口/agent 浮动面板）
- 用户拍板追加：K（右键菜单扩项）与 L（告警/回放/类型接线）从预告升级为正式节——实施主体已转开发组
- **token 教训**：用户 profile 里 export 的 GH_TOKEN（旧 fine-grained PAT，无 issues 权限）会盖过
  gh keyring OAuth 登录——gh 命令须 `env -u GH_TOKEN` 前缀（Issue 1 首提即因此失败两次后成功）。
  建议用户更新/移除该环境变量，否则每次 gh 写操作都要带前缀。
- 截图托管：fork 仓 issue-assets 分支（8 张：agent 两张 + T1 基准六张），issue 内 raw URL 渲染

## 2026-09-19（第四会话·#207 补全全部相关截图）

- 补推 10 张截图到 issue-assets 分支（累计 18 张）：03-chart-settings/03b/03d（F 大设置三 tab）、
  03h/03i（J 模板下拉+删除）、04a/04b（K 空白+图元右键菜单）、04c（I fib 属性对话框——此前死链）、
  09-bottom-bar（E 特写）、09c（L 类型菜单）、03c2（B 坐标可见性）、09d2（D 按钮特写）
- #207 正文插入 9 处图片引用（B/D/E/F/J/K/L 各节就近嵌入）并 gh issue edit 更新；
  本地预览 tv-replica-issue-preview.md 同步（图片换本地相对路径）
- 教训强化：gh 写操作必须 env -u GH_TOKEN（profile 旧 token 无上游仓权限）

## 2026-09-19（第五会话·#207 I 节图片掉链修复）

- 用户反馈 I 节"斐波那契回撤属性对话框"图不渲染
- 根因：GitHub camo 缓存 404——第一版 body 嵌入 04c 时文件尚未推到 assets 分支（camo 抓了 404 并缓存），
  后补文件源已 200 但缓存未过期；其余 17 张先推后写无此问题
- 修复：URL 加 cache-buster `?v=2` 强制 camo 重新抓取，gh issue edit 207 已更新；curl 验证 200
- 经验：issue 嵌 raw 图必须"先推文件、后写引用"；若顺序反了，修复时给 URL 加 query 参数绕 camo 缓存

## 2026-09-19（第六会话·J/K/L 五张掉图同款修复）

- 用户反馈 J 节 03h/03i、K 节 04a/04b、L 节 09c 共 5 张不渲染；curl 验证 raw 源全 200
  → 同 04c 的 camo 缓存 404 问题（第三批 10 张推送后 GitHub 内容可用性短暂延迟，issue edit 时 camo 首抓撞上）
- 修复：5 张 URL 加 ?v=2 cache-buster，gh issue edit 207 更新；新 URL 全部 curl 200；本地预览同步
- 经验固化：批量嵌 raw 图的 issue，凡"图片分批推送"场景，body 里全部 URL 统一带 cache-buster
  （或推送后等 1-2 分钟再 edit），避免 camo 缓存 404 差异化出现

## 2026-09-19（第七会话·03c2/09d2 补推）

- 用户反馈仍掉 2 张：03c2（坐标可见性下拉）/09d2（按钮特写）——**文件从未推到 assets 分支**
  （第二轮批量修复时漏列，仅复制到本地预览目录），非 camo 缓存问题
- 修复：补推两文件进 issue-assets 分支，body 两 URL 加 ?v=2，gh issue edit 207 更新，curl 双 200
- 教训：批量嵌图必须以"assets 分支 ls-tree 清单 = body 引用清单"做核对，勿凭记忆列补推清单

## 2026-09-19（第八会话·CI 修复三层根因全绿）

- 用户报告 library-ci 两轮失败（merge 5425e24a / 探针 b0cdb804）。逐层诊断三层叠加根因：
  ①lock 不同步：package.json 补回的 playwright-core 未同步进 lock（取上游 lock 时丢失）→ 提交本地 install 更新的 lock（8e77b8a6）→ build 双 job 转绿
  ②agent-runtime code-interpreter 沙箱测试 unshare Operation not permitted → 上游 25c31e3c 后已有修复
    （eac31cb8 probe unshare -rn before isolating）→ 二次 merge upstream/main 28e35c92（含 #203 native dialog modals）解决
  ③attw 类型门禁 InternalResolutionError：mt5 接线批次（写在主线 .js 化之前）31 处相对导入缺 .js 后缀
    （dataBufferTypes/mt5BarsLive/sources/mt5/bench/drawingTestKit 等，含 2 处目录导入需 /index.js）→ 批量补（7f3bb841）
- 最终 CI 35377416621 全绿（build/test × node 22.18/24 全 success）；core 2591 测试本地亦全绿
- nexus/main = 7f3bb841 已 push；三 issue 已提（#205/#206/#207）；#207 截图全部渲染正常
- 经验：上游大 PR（#202）合并后必须跑本地 lint-types（attw）+ frozen-lockfile 模拟，三道门（lock/attw/测试）
  与上游 CI 对齐；mt5 批次类"先于主线工程化改造的提交"合并进 .js 化主线时，相对导入后缀是高危盲区

## 2026-09-19（第九会话·D19 工作流决策：多轮修复走临时分支）

- 用户确认：CI 中间态红通知不应发到 nexus/main（本次 #202 合并连收 4 封失败邮件）
- D19 登记 decisions.md：多轮 CI 修复一律临时分支推进，每轮 push 该分支验证，全绿后 merge nexus/main；
  提示词 D 的 R2 同步补充（阶段 push 推 fork/t1-tv-alignment，nexus/main 只收最终绿态）

## 2026-09-20（同步上游 188e6ce1：PR #197 进上游 + 大批次新功能）

- 背景：开发组看过三个 issue（#205-207）将逐步改进；上游 main 前进到 188e6ce1（24+ 提交，324 文件）
- **PR #197（MT5 链路）正式进上游**：integrate/pr197 集成分支收编我们的原提交 + 增强
  （4003be0c MT5 进 setup/dev flow）；nexus/main 与上游的 MT5 双版本分叉就此对齐
- 新功能要点：bbc79641 图表显示时区、706e0606 右轴宽度自适应极值、560674e8 bar aggregation
  进序列身份（breaking：Mt5LiveSource 构造 3-5 参）、188e6ce1 agent 模型设置对话框重做、
  d460206c agent 输入下拉向上弹、e9cbf19e type-check:tests REQUIRED 门禁、6718210a Pi 0.85.1（breaking）
- 同步方式（D19 首次实践）：临时分支 fork/sync-upstream-20260919 合并验证，全绿后 FF 进 nexus/main
- 冲突 16 文件：AA（mt5 五件套）取上游（=我们 PR 原提交+增强）；UU 取上游（PR 内容已收编）；
  scripts 三个取上游（MT5 集成）；**踩坑一次**：目录级 `git add data/` 强制 resolve 了带标记版本，
  后续 checkout --theirs 取到污染 index——改用 git show upstream/main:path 重写并 amend
- 适配修复三个 commit：updateBars 去重（chartDataManager 自动合并双侧保留）、
  Mt5LiveSource 补 barAggregation 参数（壳侧固定 original）、_testChartAgent lookup 返回类型（新门禁暴露）
- 验证链：install/build:packages/react+angular/core 2587/nexus-shell typecheck/attw 全绿/三探针 39-15-50；
  CI run 35522663176 全绿（build+test × node 22.23.2/24.21.0——上游 CI 矩阵升最新 LTS）
- nexus/main = 12ca1dab 已 push

## 2026-09-21（MT5-connector PR #2 review + merge）

- 开发组 PR #2（+919/−267，7 commits，OpenSpec 双 change）：①barAggregation 按请求选择（original/aligned
  必填，aligned 不可用显式 UNSUPPORTED_CAPABILITY）②对齐锚固定 UTC（删 Athens/gmt2/gmt3，ALIGN_TZ→ALIGN_UTC，
  模式收敛 on|off）③ticks 实时流 SSE
- Review 结论（APPROVED + MERGED）：与上游 core 560674e8 序列身份重构配套闭环（协议层全链路 barAggregation 实测
  httpTransport:167/router:302/types:124）；UTC 锚定论证成立，original 模式的 MT5 原生边界继续承担券商图对齐
  （D15 诉求保留，实现从锚时区重采样改为原生边界，消除 aligned 无条件重采样的 12-17s 分页延迟）；
  pytest 38 passed；openspec validate --all --strict 7 passed 0 failed
- 用户侧注意事项：连接器 env 更名 ALIGN_TZ→ALIGN_UTC（默认 on 不设置即可）；nexus-shell 已传
  barAggregation=original（NexusShellContext Mt5LiveSource 构造）
- 本地连接器仓已切 main 并 pull（pr-2 临时分支已删）

## 2026-09-21（Exness 周日短棒实测证据 + issue 预览）

- 背景：开发组无 Exness 经验，不知周日短棒毛病——issue 需实测证据建立体感
- 实测（本机连接器 :8090 已起，XAUUSD daily original 120 根）：
  - **20 根 UTC 周日 bar**（2026-05-10~09-20 每周日一根，最近=昨天 09-20）
  - 周日短棒平均成交量 15,179 vs 正常日线 307,964 = **4.9%**（纯开盘噪声占完整 K 线位）
  - UTC 边界无效论证：周开盘 22:00 UTC 落在 UTC 周日桶，aligned=UTC 无法消除
  - MA(5) 扭曲实测：原始 4341.35 vs 修正 4323.51，偏差 17.84（0.41%）
  - 修正对照：周日并入周一（传统欧洲口径）后残留 0，20 组合并
- issue 预览：temp/issue-drafts/exness-sunday-bar-issue.md（请求 europe-traditional 第三口径
  或 Exness 探测自动启用传统锚；待用户审后提交）
- 数据留存：temp/exness-daily-raw.json

## 2026-09-21（连接器 PR #3：europe-traditional 口径自实现）

- 开发组表示无 Exness 经验，让用户自行修正后提 PR——方案从"求开发组"转为"自实现"
- 方案（在 PR #2 新架构上 additive）：barAggregation 第三值 europe-traditional =
  original 透传 + merge_sunday_bars 后处理（UTC 周日 bar 并入下一根周一：open=周日 open/
  high=max/low=min/close=周一 close/volume+turnover 相加；末尾孤立周日保留；无周日 no-op）。
  不引入 H1/D1 拉取——保持 PR #2 性能优化。挂接三处：REST fetch_bars/SSE _poll/probe capabilities
- 测试：44 passed（merge_sunday 4 例 + 路由合并/回显/capabilities 3 例）；
  openspec validate --all --strict 8 passed（新 change add-europe-traditional-aggregation）
- PR #3 已提：EliteOtaku/KCQ-MT5-connector/pull/3（等开发组 review）
- 实测证据留存：temp/exness-daily-raw.json（XAUUSD 120 根含 20 根周日短棒，
  MA(5) 偏差 0.41% 实测）

## 2026-09-21（PR #3 合并 + 真机验证周日消除）

- 用户提醒连接器仓为用户自有，无需等 review → PR #3 已 merge（738bfb6），本地 main 已 pull 并删临时分支
- 运行中旧进程需按 PID 精确替换（netstat -ano 定位 8090=PID 48560；勿盲杀 python.exe——机器上有多个无关 python 进程）
- 真机验证：europe-traditional 拉 XAUUSD daily 25 根——**UTC 周日残留 0**，09-21 周一根
  O=4374.16 H=4383.44 L=4322.64（周日短棒 10.4-4374.16 的 OHLC 已并入），成交量 190,706
  （对比昨日原始周日短棒仅 15K 量级——合并语义正确）
- 教训：bash 管道后 $! 取的是管道末命令退出码；curl 响应落盘后用 python 复读比管道稳定

## 2026-09-21（Exness 品牌默认口径：底层静默修正落地）

- 用户拍板：检测到 Exness → 后台静默默认修正（下游图表/入库无感），README 说明原始数据获取方式
- 实现（连接器 PR #4，已 merge）：gateway 暴露 is_exness 属性（company/server 判定已有）；
  BarRequest/SSE barAggregation 改可选——缺省按品牌解析（Exness→europe-traditional，其余→original），
  显式传值覆盖默认；响应回显实际生效口径；probe 新增 defaultBarAggregation 上报
- README/AGENTS 说明：Exness 周日短棒自动修正行为 + 三口径语义 + "需要原始数据显式传 original"
- OpenSpec：default-aggregation-by-brand（validate strict 9/9）；测试 45 passed（品牌默认三场景）
- 真机验证：缺省请求（不传 barAggregation）→ 回显 europe-traditional、25 根周日残留 0；
  probe defaultBarAggregation=europe-traditional
- 壳侧待办（下一步）：nexus-shell MT5 接线读 probe defaultBarAggregation（或先 hardcode
  europe-traditional），当前壳仍显式传 ORIGINAL——依赖壳改动后图表默认才走修正口径

## 2026-09-21（壳侧接线切换 europe-traditional + 导出链补齐）

- 壳侧 MT5 实时接线固定传 EUROPE_TRADITIONAL（NexusShellContext，含 Exness 修正语义注释）
- core 协议值域扩展：types.ts BAR_AGGREGATIONS 三值 + EUROPE_TRADITIONAL 常量定义；
  导出链补齐（provider/index.ts 值导出 + controllers/index.ts Data access 块）——
  首次编辑曾因分支切换时序丢失，本次用 Edit 工具补并即时验证 dist
- 验证：core build/core 2587 测试/nexus-shell typecheck 全绿；CI run 35624903866 success
- nexus/main = 1c87565c 已 push；5273 热加载新代码
- 闭环确认：MT5 日线图表/入库默认拿到无周日短棒序列（壳传 europe-traditional，
  连接器 merge_sunday_bars 执行）；需要 Exness 原始形态时改回 ORIGINAL_BAR_AGGREGATION
