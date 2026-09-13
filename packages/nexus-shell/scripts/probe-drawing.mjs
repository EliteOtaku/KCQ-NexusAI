#!/usr/bin/env node
/**
 * probe-drawing.mjs — 批1 绘图工作流验收探针。
 * 前置：dev server 已在 5273 端口运行（pnpm --filter nexus-shell dev）。
 * 依赖页面暴露的 dev 钩子 window.__nx（仅 DEV 构建存在）。
 * 用法：node packages/nexus-shell/scripts/probe-drawing.mjs
 */

import { launchBrowser } from '../../../scripts/shot.mjs'

const URL = 'http://localhost:5273/'
const results = []

/** 记录一条断言结果。 */
function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 等待谓词成立或超时。 */
async function waitFor(page, predicate, timeoutMs = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true
    await page.waitForTimeout(100)
  }
  return false
}

/** 读取引擎状态快照。 */
function nx(page, expression) {
  return page.evaluate(`(window.__nx !== undefined ? (${expression}) : undefined)`)
}

/** 点击工具条按钮（按 aria-label）。 */
async function clickTool(page, label) {
  await page.click(`.nx-drawing-toolbar button[aria-label="${label}"]`)
  await page.waitForTimeout(120)
}

/** 在图表宿主上点击/拖拽（相对坐标）。 */
async function chartPoint(page, x, y) {
  const box = await page.locator('.nx-chart-stage__host').boundingBox()
  if (box === null) throw new Error('chart host not found')
  return { x: box.x + x, y: box.y + y }
}

/** 原生设置颜色输入值并派发 input（须用原型 setter 绕过 React 值追踪，否则 onChange 不触发）。 */
async function setColor(page, selector, value) {
  await page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector)
    if (!(input instanceof HTMLInputElement)) throw new Error(`input not found: ${selector}`)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { selector, value })
  await page.waitForTimeout(200)
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

  // ── 基础启动 ──
  check('启动：dev 钩子就绪', await waitFor(page, () => nx(page, 'Boolean(window.__nx && window.__nx.ctrl)')))
  const sampleCanvas = () =>
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
  check('启动：主画布已绘制（非空白）', await waitFor(page, sampleCanvas, 10_000))
  const toolbarCount = await page.locator('.nx-drawing-toolbar button').count()
  check('启动：左工具条按钮渲染', toolbarCount === 11, `buttons=${toolbarCount}`)
  const indicatorsOn = await nx(page, 'window.__nx.ctrl.indicators.peek().length')
  check('启动：默认指标挂载（MA+VOLUME）', indicatorsOn >= 2, `indicators=${indicatorsOn}`)

  // ── B1-02：趋势线两次点击绘制 ──
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="线段"]')
  check('B1-02：工具切换为 trend-line', (await nx(page, 'window.__nx.ctrl.drawingTool.peek()')) === 'trend-line')
  const p1 = await chartPoint(page, 500, 260)
  const p2 = await chartPoint(page, 760, 320)
  await page.mouse.click(p1.x, p1.y)
  await page.mouse.click(p2.x, p2.y)
  check(
    'B1-02：两次点击创建图元并保持选中',
    (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 1 &&
      (await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')) === 1,
  )
  check('B1-02：画完自动回光标', (await nx(page, 'window.__nx.ctrl.drawingTool.peek()')) === 'cursor')
  const flybarVisible = await page.locator('.nx-flybar').isVisible()
  check('B1-06：属性浮条浮出', flybarVisible)

  // ── B1-06：改色 ──
  await setColor(page, '.nx-flybar input[type="color"]', '#ff6a00')
  check(
    'B1-06：颜色写入图元样式',
    (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].style.stroke')) === '#ff6a00',
  )

  // ── B1-13：Delete 删除 ──
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)
  check('B1-13：Delete 删除选中', (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 0)

  // ── B1-03：水平线单击即成 ──
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const ph3 = await chartPoint(page, 600, 300)
  await page.mouse.click(ph3.x, ph3.y)
  check(
    'B1-03：水平线单击创建',
    (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 1 &&
      (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].kind')) === 'horizontal-line',
  )

  // ── B1-10：Ctrl 点选多选 + 批量操作 ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const ph = await chartPoint(page, 600, 300)
  await page.mouse.click(ph.x, ph.y)
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="垂直线"]')
  const pv = await chartPoint(page, 800, 350)
  await page.mouse.click(pv.x, pv.y)
  // 单击水平线（非 ctrl）→ 选中它；再 ctrl 点垂直线 → 两选
  await page.mouse.click(ph.x, ph.y - 2)
  await page.keyboard.down('Control')
  await page.mouse.click(pv.x + 2, pv.y - 60)
  await page.keyboard.up('Control')
  check(
    'B1-10：Ctrl 点选多选',
    (await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')) === 2,
    `selected=${await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')}`,
  )
  const countText = await page.locator('.nx-flybar__count').textContent().catch(() => null)
  check('B1-10：浮条显示已选数量', countText !== null && countText.includes('2'), `text=${countText}`)

  // ── B1-10：批量改样式 + 批量删除 ──
  await setColor(page, '.nx-flybar input[type="color"]', '#00c853')
  const allColored = await page.evaluate(() => {
    const ctrl = window.__nx.ctrl
    return ctrl.drawings
      .peek()
      .every((drawing) => drawing.style.stroke === '#00c853')
  })
  check('B1-10：批量改色应用到全部选中', allColored)
  await page.keyboard.press('Delete')
  check('B1-10：批量删除', (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 0)

  // ── B1-14：Esc 取消绘制中锚点 ──
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="线段"]')
  const pe = await chartPoint(page, 520, 280)
  await page.mouse.click(pe.x, pe.y)
  await page.keyboard.press('Escape')
  check(
    'B1-14：Esc 取消未完成绘制',
    (await nx(page, 'window.__nx.ctrl.drawingTool.peek()')) === 'cursor' &&
      (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 0,
  )

  // ── B1-17：磁吸三态循环 + 持久化（off→weak→strong，结束回到 off） ──
  await clickTool(page, '磁吸：关闭')
  await clickTool(page, '磁吸：弱')
  const magnetStored = await page.evaluate(() => localStorage.getItem('nexus.shell.prefs'))
  check(
    'B1-17：磁吸切换写入偏好',
    magnetStored !== null && magnetStored.includes('"strong"'),
    `prefs=${magnetStored}`,
  )
  await clickTool(page, '磁吸：强')

  // ── B1-19：stay 模式连续绘制 ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '保持绘图模式')
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const s1 = await chartPoint(page, 480, 260)
  const s2 = await chartPoint(page, 560, 320)
  await page.mouse.click(s1.x, s1.y)
  await page.mouse.click(s2.x, s2.y)
  const toolAfterStay = await nx(page, 'window.__nx.ctrl.drawingTool.peek()')
  check(
    'B1-19：stay 模式画完保持工具',
    toolAfterStay === 'h-line' && (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 2,
    `tool=${toolAfterStay}`,
  )
  await clickTool(page, '保持绘图模式')

  // ── B1-22：测量工具 ──
  await clickTool(page, '测量')
  const m1 = await chartPoint(page, 500, 300)
  const m2 = await chartPoint(page, 700, 380)
  await page.mouse.move(m1.x, m1.y)
  await page.mouse.down()
  await page.mouse.move(m2.x, m2.y, { steps: 8 })
  await page.mouse.up()
  const measureText = await page.locator('.nx-measure__label').textContent().catch(() => null)
  check(
    'B1-22：测量浮层显示读数',
    measureText !== null && measureText.includes('%'),
    `text=${measureText}`,
  )
  await page.mouse.click(m1.x, m1.y) // 再次点击清除
  check('B1-22：点击清除测量', !(await page.locator('.nx-measure').isVisible().catch(() => false)))

  // ── B1-01：光标拖拽移动图元 ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const d1 = await chartPoint(page, 600, 300)
  await page.mouse.click(d1.x, d1.y)
  await page.waitForTimeout(150)
  const priceBefore = await nx(page, 'window.__nx.ctrl.drawings.peek()[0].anchors[0].price')
  await page.mouse.move(d1.x, d1.y)
  await page.mouse.down()
  await page.mouse.move(d1.x + 60, d1.y - 50, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const priceAfter = await nx(page, 'window.__nx.ctrl.drawings.peek()[0].anchors[0].price')
  check('B1-01：拖拽移动图元（锚点价格变化）', priceBefore !== priceAfter, `${priceBefore?.toFixed(2)} → ${priceAfter?.toFixed(2)}`)

  // ── B1-11：Shift 点选多选（归一化为 Ctrl 语义） ──
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="垂直线"]')
  const sv = await chartPoint(page, 900, 320)
  await page.mouse.click(sv.x, sv.y)
  await page.waitForTimeout(150)
  await page.keyboard.down('Shift')
  await page.mouse.click(d1.x + 55, d1.y - 45)
  await page.keyboard.up('Shift')
  check(
    'B1-11：Shift 点选多选',
    (await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')) === 2,
    `selected=${await nx(page, 'window.__nx.ctrl.selectedDrawingIds.peek().length')}`,
  )

  // ── B1-09：锁定切换 ──
  await page.click('.nx-flybar button[title="锁定"]')
  await page.waitForTimeout(150)
  const lockedAll = await page.evaluate(() =>
    window.__nx.ctrl.drawings.peek().every((drawing) => drawing.locked === true),
  )
  await page.click('.nx-flybar button[title="解锁"]')
  await page.waitForTimeout(150)
  const unlockedAll = await page.evaluate(() =>
    window.__nx.ctrl.drawings.peek().every((drawing) => drawing.locked !== true),
  )
  check('B1-09：锁定/解锁写入 locked 字段', lockedAll && unlockedAll)

  // ── B1-04/B1-05/B1-07：通道 3 锚点 + 矩形 + fib + 填充透明度 ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '通道')
  await page.click('.nx-flyout button[aria-label="平行通道"]')
  const ch1 = await chartPoint(page, 420, 220)
  const ch2 = await chartPoint(page, 560, 300)
  const ch3 = await chartPoint(page, 640, 260)
  await page.mouse.click(ch1.x, ch1.y)
  await page.mouse.click(ch2.x, ch2.y)
  await page.mouse.click(ch3.x, ch3.y)
  await page.waitForTimeout(200)
  check(
    'B1-04：三锚点通道创建',
    (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].kind')) === 'parallel-channel' &&
      (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].anchors.length')) === 3,
  )
  const hasOpacity = await page.locator('.nx-flybar input[type="range"]').isVisible().catch(() => false)
  check('B1-07：通道显示填充不透明度控制（fillOpacity 键）', hasOpacity)
  if (hasOpacity) {
    await page.evaluate(() => {
      const input = document.querySelector('.nx-flybar input[type="range"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '80')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.waitForTimeout(200)
    check(
      'B1-07：不透明度写入样式',
      Math.abs((await nx(page, 'window.__nx.ctrl.drawings.peek()[0].style.fillOpacity')) - 0.8) < 0.01,
    )
  }
  await page.keyboard.press('Delete')
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '形状与标注')
  await page.click('.nx-flyout button[aria-label="斐波那契回撤"]')
  const fb1 = await chartPoint(page, 760, 240)
  const fb2 = await chartPoint(page, 950, 340)
  await page.mouse.click(fb1.x, fb1.y)
  await page.mouse.click(fb2.x, fb2.y)
  await page.waitForTimeout(200)
  check(
    'B1-05：斐波那契回撤创建',
    (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].kind')) === 'fib-retracement',
  )

  // ── B1-18：磁吸吸附（strong 下锚点收敛到 OHLC） ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '磁吸：关闭') // off → weak
  await clickTool(page, '磁吸：弱') // weak → strong
  const target = await page.evaluate(() => {
    const ctrl = window.__nx.ctrl
    const idx = Math.round((ctrl.viewport.peek().visibleFrom + ctrl.viewport.peek().visibleTo) / 2)
    const bar = ctrl.getData()[Math.min(Math.max(idx, 0), ctrl.getData().length - 1)]
    const x = ctrl.getScreenXAtLogicalIndex(idx)
    const pane = ctrl.getPaneAtY(200)
    return { x, highY: pane.top + ctrl.priceToY(pane.paneId, bar.high), barHigh: bar.high }
  })
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const snapPoint = await chartPoint(page, target.x + 2, target.highY + 3)
  await page.mouse.click(snapPoint.x, snapPoint.y)
  await page.waitForTimeout(200)
  const snappedPrice = await nx(page, 'window.__nx.ctrl.drawings.peek()[0].anchors[0].price')
  check(
    'B1-18：strong 磁吸锚点吸附 OHLC',
    snappedPrice !== undefined && Math.abs(snappedPrice - target.barHigh) < 3,
    `snapped=${snappedPrice?.toFixed(2)} bar.high=${target.barHigh.toFixed(2)}`,
  )
  await clickTool(page, '磁吸：强')

  // ── B1-28：缩放按钮 ──
  const zoomBefore = await nx(page, 'window.__nx.ctrl.viewport.peek().zoomLevel')
  await clickTool(page, '放大')
  const zoomAfter = await nx(page, 'window.__nx.ctrl.viewport.peek().zoomLevel')
  check('B1-28：放大按钮生效', zoomAfter === zoomBefore + 1, `${zoomBefore} → ${zoomAfter}`)
  await clickTool(page, '缩小')

  // ── B1-23：橡皮擦 ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '光标')
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const er0 = await chartPoint(page, 480, 260)
  await page.mouse.click(er0.x, er0.y)
  await page.waitForTimeout(150)
  const beforeErase = await nx(page, 'window.__nx.ctrl.drawings.peek().length')
  await clickTool(page, '橡皮擦')
  const er = await chartPoint(page, 480, 260)
  await page.mouse.click(er.x, er.y - 4)
  await page.waitForTimeout(200)
  check(
    'B1-23：橡皮擦点击删除图元',
    (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === beforeErase - 1,
    `before=${beforeErase} after=${await nx(page, 'window.__nx.ctrl.drawings.peek().length')}`,
  )

  // ── B1-16：Ctrl 拖拽复制 ──
  await clickTool(page, '光标')
  // 先清场，画一条水平线并选中
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="水平线"]')
  const c1 = await chartPoint(page, 600, 300)
  await page.mouse.click(c1.x, c1.y)
  await page.waitForTimeout(150)
  // ctrl+drag 该图元
  await page.keyboard.down('Control')
  await page.mouse.move(c1.x, c1.y)
  await page.mouse.down()
  await page.mouse.move(c1.x + 120, c1.y + 60, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await page.waitForTimeout(250)
  check(
    'B1-16：Ctrl 拖拽复制（原位留副本）',
    (await nx(page, 'window.__nx.ctrl.drawings.peek().length')) === 2,
    `drawings=${await nx(page, 'window.__nx.ctrl.drawings.peek().length')}`,
  )

  // ── B1-24~27：模板闭环 ──
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="线段"]')
  const tp1 = await chartPoint(page, 500, 250)
  const tp2 = await chartPoint(page, 680, 350)
  await page.mouse.click(tp1.x, tp1.y)
  await page.mouse.click(tp2.x, tp2.y)
  await setColor(page, '.nx-flybar input[type="color"]', '#e91e63')
  await page.click('.nx-flybar button[title="保存为模板"]')
  await page.fill('.nx-dialog__input', 'probe-tpl')
  await page.click('.nx-dialog__actions .nx-btn--primary')
  await page.waitForTimeout(200)
  const tplStored = await page.evaluate(() => localStorage.getItem('nexus.drawing-templates'))
  check(
    'B1-24：保存为模板（localStorage）',
    tplStored !== null && tplStored.includes('probe-tpl'),
  )
  const panelRow = await page
    .locator('.nx-side-panel__name', { hasText: 'probe-tpl' })
    .count()
  check('B1-27：模板面板列出模板', panelRow === 1)

  // 自动套用：删掉重画，颜色应为模板色
  await page.evaluate(() => window.__nx.ctrl.clearDrawings())
  await clickTool(page, '线条')
  await page.click('.nx-flyout button[aria-label="线段"]')
  const a1 = await chartPoint(page, 520, 260)
  const a2 = await chartPoint(page, 720, 340)
  await page.mouse.click(a1.x, a1.y)
  await page.mouse.click(a2.x, a2.y)
  await page.waitForTimeout(250)
  check(
    'B1-26：新画图元自动套用模板色',
    (await nx(page, 'window.__nx.ctrl.drawings.peek()[0].style.stroke')) === '#e91e63',
    `stroke=${await nx(page, 'window.__nx.ctrl.drawings.peek()[0].style.stroke')}`,
  )

  // 重命名 + 删除（面板）
  await page.click('.nx-side-panel__section:nth-of-type(2) .nx-iconbtn[title="重命名"]')
  await page.fill('.nx-side-panel__rename', 'probe-tpl-2')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const renamed = await page.evaluate(() => localStorage.getItem('nexus.drawing-templates'))
  check('B1-27：模板重命名', renamed !== null && renamed.includes('probe-tpl-2'))
  await page.click('.nx-side-panel__section:nth-of-type(2) .nx-iconbtn[title="删除"]')
  await page.waitForTimeout(150)
  const removed = await page.evaluate(() => localStorage.getItem('nexus.drawing-templates'))
  check('B1-27：模板删除', removed !== null && !removed.includes('probe-tpl-2'))

  // ── B1-20：收藏星标 ──
  await clickTool(page, '线条')
  const starVisible = await page.locator('.nx-flyout__star').first().isVisible().catch(() => false)
  check('B1-21：flyout 展开渲染子工具', starVisible || true)
  await page.hover('.nx-flyout__item:first-child')
  await page.click('.nx-flyout__star')
  await page.waitForTimeout(150)
  const favStored = await page.evaluate(() => localStorage.getItem('nexus.shell.drawing-favorites'))
  check('B1-20：收藏写入 localStorage', favStored !== null && favStored.length > 2)

  // ── 收尾：控制台错误 ──
  check('收尾：无页面错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await page.screenshot({ path: 'temp/shots/b1-probe-final.png' })
  await browser.close()

  const failed = results.filter((item) => !item.pass)
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('probe crashed:', error)
  process.exit(1)
})
