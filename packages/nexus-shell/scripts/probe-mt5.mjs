#!/usr/bin/env node
/**
 * probe-mt5.mjs — MT5 数据源接线冒烟探针（桩连接器，无需真实终端）。
 * 前置：dev server 已在 5273 端口运行。用法：node packages/nexus-shell/scripts/probe-mt5.mjs
 * 覆盖：设置切源（probe 门控）→ SymbolPicker 跨源搜索 → fetcher 管线加载历史 →
 * SSE forming 更新经 updateBars 反映到图表 → 切回 Mock 断流。
 */

import { launchBrowser } from '../../../scripts/shot.mjs'
import { startStubMt5Server } from './stub-mt5-server.mjs'

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
  const stub = await startStubMt5Server(8090)
  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } })
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200))
  })
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error}`))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  // 清掉此前可能残留的 mt5 偏好，保证从 Mock 起步
  await page.evaluate(() => {
    localStorage.removeItem('nexus.shell.data-source')
    localStorage.removeItem('nexus.shell.recent-mt5-instruments')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  check('M-01：启动：dev 钩子就绪', await waitFor(page, () => nx(page, 'Boolean(window.__nx && window.__nx.ctrl)')))

  // ── M-02：数据源管理切到 MT5（打开管理对话框 → 列表含 MT5 → 设为当前） ──
  await page.click('button[aria-label="设置"]')
  check('M-02：设置对话框弹出', await page.locator('.nx-dialog').isVisible())
  await page.locator('.nx-settings__manage-btn').click()
  const managerVisible = await page.locator('.nx-source-manager').isVisible()
  const mt5RowVisible = await page
    .locator('.nx-source-item[data-source="mt5"]')
    .isVisible()
  check(
    'M-02：数据源管理列出全部注册源（含 MT5）',
    managerVisible && mt5RowVisible,
    `manager=${managerVisible} mt5Row=${mt5RowVisible}`,
  )
  // 拨测应显示对齐摘要（桩 probe message 为空，但状态应为在线）
  const mt5Online = await waitFor(
    page,
    async () =>
      (
        await page
          .locator('.nx-source-item[data-source="mt5"] .nx-source-item__status')
          .textContent()
      )?.includes('在线') === true,
    8000,
  )
  check('M-02：MT5 条目拨测在线', mt5Online)
  await page.locator('.nx-source-item[data-source="mt5"] .nx-source-item__use').click()
  const switched = await waitFor(page, () =>
    page.evaluate(() => localStorage.getItem('nexus.shell.data-source') === '"mt5"'),
  )
  check('M-02：设为当前并持久化', switched)
  // 选源成功后管理对话框自动关闭，回到设置面板；关掉设置
  await page.locator('.nx-dialog__actions .nx-btn--primary').click()

  // ── M-03：SymbolPicker 跨源搜索（走 searchInstruments → 桩 search） ──
  await page.click('.nx-symbol-picker__trigger')
  await page.fill('.nx-symbol-picker__input', 'XAU')
  const resultShown = await waitFor(
    page,
    async () => (await page.locator('.nx-symbol-option').count()) > 0,
    8000,
  )
  check('M-03：跨源搜索返回品种', resultShown)
  await page.locator('.nx-symbol-option').first().click()

  // ── M-04：fetcher 管线加载历史（setSymbols source=mt5 + bars 60 根） ──
  const loaded = await waitFor(page, () => nx(page, `
    (() => {
      const spec = window.__nx.ctrl.symbols.peek()[0]
      const data = window.__nx.ctrl.getData()
      return spec && spec.source === 'mt5' && data.length >= 60
    })()
  `))
  const specDetail = await nx(page, 'window.__nx.ctrl.symbols.peek()[0]')
  const barsCount = await nx(page, 'window.__nx.ctrl.getData().length')
  const dataError = await nx(page, 'window.__nx.ctrl.dataError ? window.__nx.ctrl.dataError.peek() : null')
  check(
    'M-04：fetcher 管线加载历史',
    loaded,
    `source=${specDetail?.source} bars=${barsCount} err=${dataError ?? ''} reqs=${stub.state.requests.join(',')}`,
  )

  // ── M-05：SSE forming 更新经 updateBars 反映到末根（close → 2600.5） ──
  const formed = await waitFor(page, () => nx(page, `
    (() => {
      const data = window.__nx.ctrl.getData()
      return data.length > 0 && data[data.length - 1].close === 2600.5
    })()
  `), 8000)
  const lastClose = await nx(page, 'window.__nx.ctrl.getData().at(-1).close')
  check('M-05：SSE forming 更新写入末根', formed, `lastClose=${lastClose}`)

  // ── M-06：切回 Mock（走数据源管理）→ SSE 断流（活跃连接归零） ──
  await page.click('button[aria-label="设置"]')
  await page.locator('.nx-settings__manage-btn').click()
  await page.locator('.nx-source-item[data-source="mock"] .nx-source-item__use').click()
  await page.locator('.nx-dialog__actions .nx-btn--primary').click()
  const streamClosed = await waitFor(page, () => stub.state.activeStreams === 0, 5000)
  const backToMock = await nx(page, 'window.__nx.ctrl.symbols.peek()[0].source')
  check('M-06：切回 Mock 并断流', streamClosed && backToMock !== 'mt5', `active=${stub.state.activeStreams} source=${backToMock}`)

  // ── M-07：无页面错误（mock 回归不受影响） ──
  check(
    'M-07：无页面错误',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | ') || 'clean',
  )

  // 收尾：清 mt5 偏好，保持后续探针从 Mock 起步
  await page.evaluate(() => {
    localStorage.removeItem('nexus.shell.data-source')
    localStorage.removeItem('nexus.shell.recent-mt5-instruments')
  })

  const failed = results.filter((item) => !item.pass).length
  console.log(`\n==== ${results.length - failed}/${results.length} passed ====`)
  await browser.close()
  await stub.close()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
