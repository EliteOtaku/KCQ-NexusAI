import { launchBrowser } from '../../../scripts/shot.mjs'

const browser = await launchBrowser()
const page = await browser.newPage()
const failed = []
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(r.status() + ' ' + r.url())
})
await page.goto('http://localhost:5273/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(5000)
console.log(JSON.stringify(failed, null, 1))
await browser.close()
process.exit(0)
