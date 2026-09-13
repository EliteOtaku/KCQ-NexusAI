#!/usr/bin/env node
/**
 * shot.mjs — nexus-shell 截图工具（playwright-core + 系统 Chrome，无浏览器下载）。
 * 用法：node scripts/shot.mjs <url> <out.png> [--wait 4000]
 * 交互式场景截图请在 temp/ 下编写临时脚本复用本文件的 launchBrowser()。
 */

import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/** 系统 Chrome 候选路径（Windows 常规安装位置）。 */
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]

/** 启动无头系统 Chrome；找不到时给出明确报错。 */
export async function launchBrowser() {
  const executablePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
  if (executablePath === undefined) {
    throw new Error('未找到系统 Chrome（候选路径均不存在）')
  }
  return chromium.launch({ executablePath, headless: true })
}

/** 打开页面并截图；收集控制台错误返回。 */
export async function capture(url, outPath, waitMs = 4000) {
  const browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } })
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 300))
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error}`))
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(waitMs)
  mkdirSync(path.dirname(outPath), { recursive: true })
  await page.screenshot({ path: outPath })
  await browser.close()
  return errors
}

// CLI 直跑模式。
const [, , url, outPath, waitArg] = process.argv
if (url && outPath) {
  const waitMs = waitArg === undefined ? 4000 : Number(waitArg)
  const errors = await capture(url, outPath, waitMs)
  console.log(JSON.stringify({ url, outPath, nErrors: errors.length, errors: errors.slice(0, 6) }))
}
