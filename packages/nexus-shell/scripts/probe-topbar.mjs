#!/usr/bin/env node
/**
 * probe-topbar.mjs — 批2 顶栏验收探针（品种搜索器 + 周期下拉 + 图例查证）。
 * 前置：dev server 已在 5273 端口运行。用法：node packages/nexus-shell/scripts/probe-topbar.mjs
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

async function main() {
  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } })
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200))
  })
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error}`))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  check('启动：dev 钩子就绪', await waitFor(page, () => nx(page, 'Boolean(window.__nx && window.__nx.ctrl)')))

  // ── B2-02：周期分组下拉 ──
  const groupsCount = await page.locator('.nx-topbar__period optgroup').count()
  check('B2-02：周期下拉分组渲染', groupsCount === 3, `groups=${groupsCount}`)
  await page.selectOption('.nx-topbar__period', '60min')
  await page.waitForTimeout(600)
  const afterPeriod = await nx(page, 'window.__nx.ctrl.symbols.peek()[0]')
  const bars60 = await nx(page, 'window.__nx.ctrl.getData().length')
  check(
    'B2-02：切换周期重注数据',
    afterPeriod?.period === '60min' && bars60 > 0,
    `period=${afterPeriod?.period} bars=${bars60}`,
  )
  await page.selectOption('.nx-topbar__period', 'daily')
  await page.waitForTimeout(600)

  // ── B2-01：品种搜索器 ──
  await page.click('.nx-symbol-picker__trigger')
  const panelVisible = await page.locator('.nx-symbol-picker__panel').isVisible()
  check('B2-01：搜索面板展开', panelVisible)
  const optionCount = await page.locator('.nx-symbol-option').count()
  check('B2-01：品种目录列出', optionCount >= 6, `options=${optionCount}`)
  // 关键字过滤
  await page.fill('.nx-symbol-picker__input', 'TECH')
  await page.waitForTimeout(200)
  const filtered = await page.locator('.nx-symbol-option').count()
  check('B2-01：关键字过滤', filtered === 1, `filtered=${filtered}`)
  await page.fill('.nx-symbol-picker__input', '不存在的品种')
  await page.waitForTimeout(200)
  const emptyVisible = await page.locator('.nx-symbol-picker__empty').isVisible()
  check('B2-01：无匹配空态', emptyVisible)
  // 选中品种
  await page.fill('.nx-symbol-picker__input', 'SH501')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  const symbolAfter = await nx(page, 'window.__nx.ctrl.symbols.peek()[0].symbol')
  check('B2-01：Enter 选中并切换品种', symbolAfter === 'MOCK-SH501', `symbol=${symbolAfter}`)
  const recentStored = await page.evaluate(() => localStorage.getItem('nexus.shell.recent-symbols'))
  check('B2-01：最近使用写入 localStorage', recentStored !== null && recentStored.includes('MOCK-SH501'))
  // 再次打开应显示最近使用分组
  await page.click('.nx-symbol-picker__trigger')
  const recentGroupVisible = await page
    .locator('.nx-symbol-picker__group', { hasText: '最近使用' })
    .isVisible()
  check('B2-01：最近使用分组展示', recentGroupVisible)
  await page.keyboard.press('Escape')
  await page.click('.nx-chart-stage__host', { position: { x: 700, y: 300 } })

  // ── B2-03：图例查证（引擎画布图例，左上角文字像素采样） ──
  const legendPainted = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.main-canvas.main')
    if (!(canvas instanceof HTMLCanvasElement)) return false
    const ctx = canvas.getContext('2d')
    if (ctx === null) return false
    // 图例区在左上角；采样前 340x22 区域内是否有文字类像素（与背景差异）。
    const sample = ctx.getImageData(0, 0, Math.min(340, canvas.width), 22).data
    let textPixels = 0
    for (let i = 0; i < sample.length; i += 4) {
      const alpha = sample[i + 3]
      if (alpha > 40) textPixels++
    }
    return textPixels > 60
  })
  check('B2-03：主图画布左上角图例渲染（引擎默认）', legendPainted)

  // ── 收尾 ──
  check('收尾：无页面错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  await page.screenshot({ path: 'temp/shots/b2-topbar.png' })
  await browser.close()

  const failed = results.filter((item) => !item.pass)
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('probe crashed:', error)
  process.exit(1)
})
