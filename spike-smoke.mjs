/* 临时 spike，验证 #283：playwright 冒烟脚本（node spike-smoke.mjs）。
 * 打开 dev server 5179 → 等 spike 层挂载 + connector 数据 → 断言无 console error →
 * 截图（缩放/拖动前后）→ 读 window.__spike283 → 输出 JSON 结果。 */
import { chromium } from 'file:///D:/AI/cloudtradeagent-vela/webui/frontend/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'

const EXE = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'
const URL = 'http://127.0.0.1:5179/'
const SHOT = (n) => `D:/AI/cloudtradeagent/spike283-${n}.png`
const RESULT = 'D:/AI/cloudtradeagent/spike283-result.json'

const consoleErrors = []
const consoleWarnings = []
const pageErrors = []
const failedRequests = []

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } })
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`${m.text()} @ ${m.location()?.url ?? '?'}`)
  if (m.type() === 'warning') consoleWarnings.push(m.text())
})
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`))
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`HTTP ${r.status()} ${r.url()}`)
})
page.on('websocket', (ws) => failedRequests.push(`WS open ${ws.url()}`))

// 无头旧 chromium 的 GPU 呈现不可靠：显式走 Canvas2D 后端（仅测试环境适配，
// localStorage 设置键 = kline-chart-settings.rendererBackend）
await page.addInitScript(() => {
  const KEY = 'kline-chart-settings'
  let prev = {}
  try { prev = JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch {}
  localStorage.setItem(KEY, JSON.stringify({ ...prev, rendererBackend: 'canvas' }))
})
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

// 等 spike 层挂载（官方面 useRenderer 完成且 getRenderer 命中）
await page.waitForFunction(() => window.__spike283?.layerMounted === true, null, { timeout: 30000 })
// 等主图数据（connector XAUUSD daily 500 根）与 HTF 槽（5 槽）到齐，且至少绘制过一帧
await page.waitForFunction(
  () =>
    window.__spike283 &&
    window.__spike283.mainBars > 0 &&
    window.__spike283.draws > 0 &&
    window.__spike283.viewportReset === true,
  null,
  { timeout: 45000 },
)
await page.waitForFunction(() => (window.__spike283?.htfSlotsReady ?? 0) >= 5, null, { timeout: 45000 })
await page.waitForTimeout(2500) // 渲染稳定

const canvas = page.locator('.embed-container canvas').first()
const box = await canvas.boundingBox()
if (!box) throw new Error('chart canvas not found')
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

const before = await page.evaluate(() => ({
  draws: window.__spike283.draws,
  requestRenderCalls: window.__spike283.requestRenderCalls,
}))

// 基线截图（默认视口）
await page.screenshot({ path: SHOT('1-overview') })

// ── 交互并存核查 ①：滚轮缩放（Main 帧重绘 → 一目层应随 kLineCenters 跟随）──
for (let i = 0; i < 6; i++) {
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, -240) // 放大
  await page.waitForTimeout(150)
}
await page.waitForTimeout(1200)
const drawsAfterZoomIn = await page.evaluate(() => window.__spike283.draws)
await page.screenshot({ path: SHOT('2-zoom-in') })

for (let i = 0; i < 8; i++) {
  await page.mouse.move(cx, cy)
  await page.mouse.wheel(0, 320) // 缩小
  await page.waitForTimeout(150)
}
await page.waitForTimeout(1200)
const drawsAfterZoomOut = await page.evaluate(() => window.__spike283.draws)
await page.screenshot({ path: SHOT('3-zoom-out-slices') })

// ── 交互并存核查 ②：拖动平移 ──
await page.mouse.move(cx, cy)
await page.mouse.down()
for (let i = 1; i <= 10; i++) await page.mouse.move(cx - i * 30, cy, { steps: 2 })
await page.mouse.up()
await page.waitForTimeout(1000)
const drawsAfterPan = await page.evaluate(() => window.__spike283.draws)
await page.screenshot({ path: SHOT('4-pan') })

// ── 交互并存核查 ③：价格轴新交互（#275：A/L 快捷钮 + 悬停标签 + 设置菜单）──
let priceAxis = { shortcutsFound: false, shortcutTexts: [], hoverLabelVisible: false, menuTriggerFound: false }
const axisZone = page.locator('.price-axis-controls')
if ((await axisZone.count()) > 0) {
  await axisZone.hover({ force: true })
  await page.waitForTimeout(600)
  const shortcuts = page.locator('.price-axis-shortcuts button')
  const n = await shortcuts.count()
  priceAxis.shortcutsFound = n > 0
  for (let i = 0; i < n; i++) priceAxis.shortcutTexts.push((await shortcuts.nth(i).textContent())?.trim())
  // 悬停标签（BaseTooltip）出现与否
  await page.waitForTimeout(400)
  const tipVisible = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[role="tooltip"], .base-tooltip, [class*="tooltip"]'))
    return els.some((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0'
    })
  })
  priceAxis.hoverLabelVisible = tipVisible
  await page.screenshot({ path: SHOT('5-priceaxis-hover') })
  // 设置菜单触发钮存在性
  priceAxis.menuTriggerFound = (await page.locator('.axis-settings-menu').count()) > 0
}

// 终态句柄读数
const handle = await page.evaluate(() => window.__spike283)
const lastFrame = await page.evaluate(() => window.__spike283?.lastFrame ?? null)
// 环境噪声排除：upstream preview 本身无 favicon（404）；vite HMR WS 非数据通道
const hardErrors = consoleErrors.filter((e) => !e.includes('/favicon.ico'))
const result = {
  handle,
  lastFrame,
  interactions: {
    drawsBefore: before.draws,
    drawsAfterZoomIn,
    drawsAfterZoomOut,
    drawsAfterPan,
    requestRenderCalls: handle.requestRenderCalls,
  },
  priceAxis,
  consoleErrors,
  hardErrors,
  consoleWarnings,
  pageErrors,
  failedRequests,
  ok:
    hardErrors.length === 0 &&
    pageErrors.length === 0 &&
    handle.layerMounted === true &&
    handle.draws > 0 &&
    handle.mainBars > 0 &&
    handle.htfSlotsReady >= 5 &&
    handle.viewportReset === true &&
    drawsAfterPan > before.draws,
}
fs.writeFileSync(RESULT, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
await browser.close()
process.exit(result.ok ? 0 : 2)
