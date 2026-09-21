import { launchBrowser } from '../../../scripts/shot.mjs'
const browser = await launchBrowser()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 250)) })
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 350)))
await page.goto('http://localhost:5273/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(6000)
console.log(JSON.stringify(errors.slice(0, 5), null, 1))
await browser.close()
process.exit(0)
