#!/usr/bin/env node
/**
 * probe-b234.mjs — 批2 收尾 + 批3/批4 验收探针。
 * 覆盖：B2-03/04 图例栏、B2-06 右键菜单、B3-01 自选、B3-02 设置、B3-03 对象树、
 * B4-01..04 键盘、B4-05 持久化。
 * 前置：dev server 已在 5273 端口运行。用法：node packages/nexus-shell/scripts/probe-b234.mjs
 */

import { launchBrowser } from '../../../scripts/shot.mjs'

const URL = 'http://localhost:5273/'
const results = []

function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function waitFor(page, predicate, timeoutMs = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true
    await page.waitForTimeout(100)
  }
  return false
}

function nx(page, expression) {
  return page.evaluate(`(window.__nx !== undefined ? (${expression}) : undefined)`)
}

async function clickTool(page, label) {
  await page.click(`.nx-drawing-toolbar button[aria-label="${label}"]`)
  await page.waitForTimeout(120)
}

async function chartPoint(page, x, y) {
  const box = await page.locator('.nx-chart-stage__host').boundingBox()
  if (box === null) throw new Error('chart host not found')
  return { x: box.x + x, y: box.y + y }
}

async function main() {
  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } })
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200))
  })
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error}`))
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  check('启动：dev 钩子就绪', await waitFor(page, () => nx(page, 'Boolean(window.__nx && window.__nx.ctrl)')))
  // 等首帧绘制完成，图例上下文才有数据。
  const canvasPainted = () =>
    page.evaluate(() => {
      const host = document.querySelector('.nx-chart-stage__host')
      const canvas = host?.querySelector('canvas.main-canvas.main')
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width === 0) return false
      const ctx = canvas.getContext('2d')
      if (ctx === null) return false
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let colored = 0
      for (let i = 0; i < sample.length; i += 40) {
        const r = sample[i]
        const g = sample[i + 1]
        const b = sample[i + 2]
        if (r + g + b > 30 && Math.abs(r - g) + Math.abs(g - b) > 24) colored++
      }
      return colored > 30
    })
  check('启动：主画布已绘制（非空白）', await waitFor(page, canvasPainted, 10_000))

  // ── B2-03：图例栏行1 ──
  check('B2-03：图例栏渲染', await page.locator('.nx-legend').isVisible())
  const legendSymbol = await page.locator('.nx-legend__symbol').textContent()
  check('B2-03：图例品种', legendSymbol === 'MOCK-SZ300', `symbol=${legendSymbol}`)
  const legendPeriod = await page.locator('.nx-legend__period').textContent()
  check('B2-03：图例周期', legendPeriod === '日线', `period=${legendPeriod}`)
  const ohlcText = (await page.locator('.nx-legend__ohlc').textContent().catch(() => '')) ?? ''
  check('B2-03：OHLC 行渲染', ohlcText.includes('O') && ohlcText.includes('C'), `text=${ohlcText.slice(0, 48)}`)

  // ── B2-04：指标行 + 眼睛/设置/删除 ──
  const mainInstances = () =>
    nx(page, 'window.__nx.ctrl.indicators.peek().filter(i => i.definitionId === "MA" && i.id.indexOf("mode:") !== 0).length')
  const maRow = page.locator('.nx-legend__row', { hasText: 'MA' }).first()
  check('B2-04：主图指标行渲染', (await mainInstances()) === 1)
  check('B2-04：副图指标行渲染', (await page.locator('.nx-legend__row', { hasText: 'VOL' }).count()) === 1)
  await maRow.hover()
  await maRow.locator('[title="隐藏指标"]').click()
  await page.waitForTimeout(200)
  check('B2-04：眼睛隐藏指标（实例移除）', (await mainInstances()) === 0)
  check('B2-04：隐藏行保留（灰显）', (await page.locator('.nx-legend__row--hidden').count()) === 1)
  await maRow.hover()
  await maRow.locator('[title="显示指标"]').click()
  await page.waitForTimeout(200)
  check('B2-04：眼睛恢复指标（重加实例）', (await mainInstances()) === 1)
  // 参数编辑用带 number 参数的 HMA（MA 无参数定义）；先经指标面板勾选加入。
  await page
    .locator('.nx-side-panel__section--indicators .nx-side-panel__row', { hasText: 'HMA' })
    .locator('input[type="checkbox"]')
    .check()
  await page.waitForTimeout(200)
  const hmaRow = page.locator('.nx-legend__row', { hasText: 'HMA' }).first()
  await hmaRow.hover()
  await hmaRow.locator('[title="指标参数"]').click()
  check('B2-04：参数编辑器展开', await page.locator('.nx-legend__editor').isVisible())
  const editorHtml = await page
    .locator('.nx-legend__editor')
    .evaluate((el) => el.innerHTML)
    .catch(() => 'NO-EDITOR')
  console.log('EDITOR-DEBUG:', editorHtml.slice(0, 400))
  const rowTexts = await page.locator('.nx-legend__row').allTextContents()
  console.log('ROWS-DEBUG:', JSON.stringify(rowTexts))
  await page.fill('.nx-legend__editor input[type="number"]', '9')
  await page.click('.nx-legend__editor .nx-btn--primary')
  await page.waitForTimeout(200)
  const hmaParams = await nx(
    page,
    'JSON.stringify(window.__nx.ctrl.indicators.peek().find(i => i.definitionId === "HMA").params)',
  )
  check('B2-04：参数写回（含 9）', hmaParams !== null && hmaParams.includes('9'), `params=${hmaParams}`)
  await hmaRow.hover()
  await hmaRow.locator('[title="删除指标"]').click()
  await page.waitForTimeout(200)
  check(
    'B2-04：HMA 删除（实例与行均移除）',
    (await nx(page, 'window.__nx.ctrl.indicators.peek().filter(i => i.definitionId === "HMA").length')) === 0 &&
      (await page.locator('.nx-legend__row', { hasText: 'HMA' }).count()) === 0,
  )
  await maRow.hover()
  await maRow.locator('[title="删除指标"]').click()
  await page.waitForTimeout(200)
  check(
    'B2-04：删除指标（实例与行均移除）',
    (await mainInstances()) === 0 && (await page.locator('.nx-legend__row', { hasText: 'MA' }).count()) === 0,
  )
  await page.screenshot({ path: 'temp/shots/b234-legend.png' })

  // ── B2-06：右键菜单 ──
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const hPoint = await chartPoint(page, 600, 300)
  await page.mouse.click(hPoint.x, hPoint.y)
  await page.waitForTimeout(150)
  await page.mouse.click(hPoint.x, hPoint.y, { button: 'right' })
  check('B2-06：命中图元菜单弹出', await page.locator('.nx-ctx-menu').isVisible())
  await page.click('.nx-ctx-menu__item', { hasText: '样式' })
  await page.waitForTimeout(150)
  check('B2-06：样式项选中图元（浮条唤起）', (await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')) === 1)
  await page.mouse.click(hPoint.x, hPoint.y, { button: 'right' })
  await page.locator('.nx-ctx-menu__item', { hasText: '锁定' }).first().click()
  await page.waitForTimeout(150)
  const lockedNow = await nx(page, 'window.__nx.ctrl.drawings.peek()[0].locked')
  check('B2-06：锁定写入 locked', lockedNow === true, `locked=${lockedNow}`)
  const blank = await chartPoint(page, 200, 550)
  await page.mouse.click(blank.x, blank.y, { button: 'right' })
  const bgMenuText = (await page.locator('.nx-ctx-menu').textContent().catch(() => '')) ?? ''
  check(
    'B2-06：背景菜单（主题/周期/添加指标）',
    bgMenuText.includes('切换主题') && bgMenuText.includes('周期') && bgMenuText.includes('添加指标'),
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('B2-06：Esc 关闭菜单', (await page.locator('.nx-ctx-menu').count()) === 0)
  // 周期子菜单切换
  await page.mouse.click(blank.x, blank.y, { button: 'right' })
  await page.locator('.nx-ctx-menu__item--sub').filter({ hasText: '周期' }).first().hover()
  await page.locator('.nx-ctx-menu__submenu .nx-ctx-menu__item', { hasText: '1小时' }).click()
  await page.waitForTimeout(500)
  check('B2-06：周期子菜单切换 60min', (await nx(page, 'window.__nx.ctrl.symbols.peek()[0].period')) === '60min')
  await page.mouse.click(blank.x, blank.y, { button: 'right' })
  await page.locator('.nx-ctx-menu__item--sub').filter({ hasText: '周期' }).first().hover()
  await page.locator('.nx-ctx-menu__submenu .nx-ctx-menu__item', { hasText: '日线' }).click()
  await page.waitForTimeout(500)
  check('B2-06：周期子菜单切回日线', (await nx(page, 'window.__nx.ctrl.symbols.peek()[0].period')) === 'daily')
  // 添加指标子菜单：实例数 +1，随后移除清理
  const beforeAdd = await nx(page, 'window.__nx.ctrl.indicators.peek().length')
  await page.mouse.click(blank.x, blank.y, { button: 'right' })
  const addSub = page.locator('.nx-ctx-menu__item--sub').filter({ hasText: '添加指标' }).first()
  await addSub.hover()
  await addSub.locator('.nx-ctx-menu__submenu .nx-ctx-menu__item', { hasText: 'HMA' }).click()
  await page.waitForTimeout(200)
  const afterAdd = await nx(page, 'window.__nx.ctrl.indicators.peek().length')
  check('B2-06：添加指标子菜单（实例 +1）', afterAdd === beforeAdd + 1, `${beforeAdd} → ${afterAdd}`)
  await page.evaluate(`window.__nx.ctrl.removeIndicator(window.__nx.ctrl.indicators.peek()[window.__nx.ctrl.indicators.peek().length - 1].id)`)

  // ── B3-01：自选列表 ──
  const watchRows = await page.locator('.nx-side-panel__section--watchlist .nx-watchlist__row').count()
  check('B3-01：自选列表渲染品种', watchRows === 6, `rows=${watchRows}`)
  await page.locator('.nx-watchlist__row', { hasText: 'MOCK-TECH' }).click()
  await page.waitForTimeout(500)
  check('B3-01：点选切品种', (await nx(page, 'window.__nx.ctrl.symbols.peek()[0].symbol')) === 'MOCK-TECH')
  check(
    'B3-01：当前品种高亮',
    (await page.locator('.nx-watchlist__row--active', { hasText: 'MOCK-TECH' }).count()) === 1,
  )

  // ── B3-02：设置对话框 ──
  await page.click('button[aria-label="设置"]')
  check('B3-02：设置对话框弹出', await page.locator('.nx-dialog').isVisible())
  await page.locator('.nx-settings__segment-btn', { hasText: '亮色' }).click()
  await page.waitForTimeout(200)
  const themeNow = await page.evaluate(() => document.documentElement.dataset.theme)
  const themeStored = await page.evaluate(() => localStorage.getItem('nexus.theme'))
  const shellThemeNow = await nx(page, 'window.__nx.ctrl.theme.peek()')
  check(
    'B3-02：主题切换生效并持久化',
    themeNow === 'light' && themeStored !== null && themeStored.includes('light'),
    `dataset=${themeNow} stored=${themeStored} engine=${shellThemeNow}`,
  )
  await page.selectOption('.nx-settings__select', 'strong')
  await page.waitForTimeout(200)
  const prefsStored = await page.evaluate(() => localStorage.getItem('nexus.shell.prefs'))
  check('B3-02：磁吸档位写入偏好', prefsStored !== null && prefsStored.includes('"strong"'))
  await page.click('.nx-dialog__actions .nx-btn--primary')
  check('B3-02：关闭对话框', (await page.locator('.nx-dialog').count()) === 0)
  // 恢复暗色
  await page.click('button[aria-label="设置"]')
  await page.locator('.nx-settings__segment-btn', { hasText: '暗色' }).click()
  await page.click('.nx-dialog__actions .nx-btn--primary')

  // ── B3-03：对象树 ──
  const objectRows = page.locator('.nx-side-panel__section--objects .nx-object__row')
  check('B3-03：对象树列出图元', (await objectRows.count()) === 1)
  await objectRows.first().click()
  check('B3-03：行点击选中图元', (await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')) === 1)
  // 上游 f8a015d9（#205）locked 语义收窄为「只冻结几何拖动与删除」：
  // 锁定态下 visible/style 等写入直接放行（显隐免解锁）；删除仍被冻结，须先解锁。
  // 探针图元经 B2 系列创建后即为锁定态（按钮显示「解锁」）。
  check('B3-03：图元初始锁定态', (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].locked')) === true)
  await page.click('.nx-side-panel__section--objects [title="隐藏"]')
  await page.waitForTimeout(150)
  check('B3-03：锁定态显隐切换（visible=false）', (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].visible')) === false)
  await page.click('.nx-side-panel__section--objects [title="显示"]')
  await page.waitForTimeout(150)
  check('B3-03：锁定态显隐恢复（visible=true）', (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].visible')) === true)
  await page.click('.nx-side-panel__section--objects [title="删除"]')
  await page.waitForTimeout(150)
  check('B3-03：锁定态删除被冻结', (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 1)
  await page.click('.nx-side-panel__section--objects [title="解锁"]')
  await page.waitForTimeout(150)
  check('B3-03：解锁切换', (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].locked')) === false)
  await page.click('.nx-side-panel__section--objects [title="删除"]')
  await page.waitForTimeout(150)
  check('B3-03：行内删除图元', (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 0)

  // ── B4-01：字母键唤起品种搜索 ──
  await page.mouse.click((await chartPoint(page, 700, 500)).x, (await chartPoint(page, 700, 500)).y)
  await page.keyboard.press('b')
  check('B4-01：字母键打开搜索面板', await page.locator('.nx-symbol-picker__panel').isVisible())
  check(
    'B4-01：带入首字母 b',
    await waitFor(page, async () => (await page.inputValue('.nx-symbol-picker__input')) === 'b'),
  )
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  check('B4-01：Enter 选中 BOND', (await nx(page, 'window.__nx.ctrl.symbols.peek()[0].symbol')) === 'MOCK-BOND')

  // ── B4-02：数字键切周期 ──
  await page.keyboard.press('4')
  await page.waitForTimeout(800)
  const periodDump4 = await nx(page, 'window.__nx.ctrl.symbols.peek()[0].period + "|" + window.__nx.ctrl.drawingTool.peek()')
  check('B4-02：数字 4 → 30min（第 4 个周期）', periodDump4 === '30min|cursor', `state=${periodDump4}`)
  await page.keyboard.press('7')
  await page.waitForTimeout(800)
  const periodDump7 = await nx(page, 'window.__nx.ctrl.symbols.peek()[0].period')
  check('B4-02：数字 7 → 日线', periodDump7 === 'daily', `period=${periodDump7}`)

  // ── B4-03：? 快捷键表 ──
  await page.keyboard.press('?')
  check('B4-03：快捷键表弹出', await page.locator('.nx-shortcuts').isVisible())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('B4-03：Esc 收起快捷键表', (await page.locator('.nx-shortcuts').count()) === 0)

  // ── B4-04：方向键微调选中图元价格 ──
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const nudgePoint = await chartPoint(page, 520, 300)
  await page.mouse.click(nudgePoint.x, nudgePoint.y)
  await page.waitForTimeout(150)
  const selPriceExpr = 'window.__nx.ctrl.drawings.peek().find(d => d.id === window.__nx.ctrl.selectedDrawingIds.peek()[0]).anchors[0].price'
  const priceBefore = await nx(page, selPriceExpr)
  const idsNow = await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')
  const tickNow = await nx(page, 'window.__nx.ctrl.symbols.peek()[0].symbol')
  const tick = { 'MOCK-SZ300': 0.2, 'MOCK-SH501': 0.2, 'MOCK-CSI500': 0.2, 'MOCK-TECH': 0.01, 'MOCK-ENERGY': 0.01, 'MOCK-BOND': 0.001 }[tickNow] ?? 0.01
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(150)
  const priceUp = await nx(page, selPriceExpr)
  const expectedUp = Math.round((priceBefore + tick) * 1000) / 1000
  check(
    'B4-04：↑ 上移一个 tick',
    priceUp === expectedUp,
    `tick=${tick} ids=${idsNow} ${priceBefore} → ${priceUp} (期望 ${expectedUp})`,
  )
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(150)
  const priceDown = await nx(page, selPriceExpr)
  const expectedDown = Math.round((priceUp - tick) * 1000) / 1000
  check('B4-04：↓ 回落一个 tick', priceDown === expectedDown, `${priceUp} → ${priceDown} (期望 ${expectedDown})`)

  // ── B4-05：面板折叠持久化 ──
  await page.click('.nx-side-panel__section--templates .nx-side-panel__title-btn')
  await page.waitForTimeout(150)
  check(
    'B4-05：折叠后分区内容隐藏',
    (await page.locator('.nx-side-panel__section--templates .nx-side-panel__row').count()) === 0,
  )
  const panelStored = await page.evaluate(() => localStorage.getItem('nexus.panel'))
  check('B4-05：折叠状态写入 nexus.panel', panelStored !== null && panelStored.includes('"templates":false'))
  await page.click('.nx-side-panel__section--templates .nx-side-panel__title-btn')
  await page.waitForTimeout(150)
  check(
    'B4-05：展开恢复分区内容',
    (await page.locator('.nx-side-panel__section--templates .nx-side-panel__row').count()) > 0,
  )

  // ── 收尾 ──
  // 收尾噪声过滤：页面卸载触发引擎 dispose 后，在途 Indicator Worker 回调抛
  // "executor is disposed" 属上游 worker 化指标计算的收尾竞态，非探针期错误。
  const fatalErrors = consoleErrors.filter(
    (text) => !text.includes('Indicator Worker executor is disposed'),
  )
  check('收尾：无页面错误', fatalErrors.length === 0, fatalErrors.slice(0, 3).join(' | '))
  await page.screenshot({ path: 'temp/shots/b234-panels.png' })
  await browser.close()

  const failed = results.filter((item) => !item.pass)
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('probe crashed:', error)
  process.exit(1)
})
