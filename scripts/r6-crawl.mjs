// Load every staff and storefront page as each demo role and print PASS/FAIL per page.
// Usage: CRAWL_BASE=https://host CRAWL_LOGINS=/path/logins.json node scripts/r6-crawl.mjs [roles...]
// CRAWL_LOGINS is { "<role>": { "email", "password" } } kept outside the repo.
import fs from 'node:fs'
import { chromium } from '/Users/junaid/Code/vibeghost/vibeghost/node_modules/playwright/index.mjs'

const BASE = process.env.CRAWL_BASE
const people = JSON.parse(fs.readFileSync(process.env.CRAWL_LOGINS, 'utf8'))
const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(people)
const gql = async (query, cookie) => (await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ query }) })).json()
const p0 = people[roles[0]]
const tr = await (await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'mutation($e:String!,$p:String!){authenticateUserWithPassword(email:$e,password:$p){... on UserAuthenticationWithPasswordSuccess{sessionToken}}}', variables: { e: p0.email, p: p0.password } }) })).json()
const cookie = 'keystonejs-session=' + tr.data?.authenticateUserWithPassword?.sessionToken
const ids = (await gql('{customers(take:1){id} sales(take:1){id} products(take:1){id}}', cookie)).data ?? {}
const staff = ['', 'audit', 'authority', 'cash', 'compliance', 'customers', 'incidents', 'inventory', 'menu', 'payment-providers', 'pos', 'recalls', 'receiving', 'reconciliation', 'sales', 'staff', 'store-settings']
const staffPaths = staff.map(s => '/dashboard/platform' + (s ? '/' + s : ''))
if (ids.customers?.[0]) staffPaths.push('/dashboard/platform/customers/' + ids.customers[0].id)
if (ids.sales?.[0]) staffPaths.push('/dashboard/platform/sales/' + ids.sales[0].id)
if (ids.products?.[0]) staffPaths.push('/dashboard/platform/menu/' + ids.products[0].id)
const nope = ['/dashboard/platform/customers/nope123', '/dashboard/platform/sales/nope123', '/dashboard/platform/menu/nope123']
const shop = ['/', '/menu', '/bag', '/visit', '/order/nope123', '/menu/nope123']
if (ids.products?.[0]) shop.push('/menu/' + ids.products[0].id)
const b = await chromium.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
let bad = 0, n = 0
const check = async (p, role, path, want404) => {
  const r = await p.goto(BASE + path, { waitUntil: 'load', timeout: 90000 }).catch(() => null)
  await p.waitForTimeout(1500)
  const txt = await p.evaluate(() => document.body.innerText).catch(() => '')
  const http = r?.status() ?? 0
  const ok = want404 ? http === 404 : http === 200 && !/this page could not be loaded|something went wrong|application error/i.test(txt)
  n++; if (!ok) bad++
  console.log(`CHECK ${role} ${path}: ${ok ? 'PASS' : 'FAIL'} (${http}${want404 ? ' expected 404' : ''})${ok ? '' : ' ' + JSON.stringify(txt.match(/.{0,80}(this page could not be loaded|something went wrong|application error).{0,80}/is)?.[0] ?? txt.slice(0, 120))}`)
}
{ // storefront, signed out
  const p = await (await b.newContext({ ignoreHTTPSErrors: true })).newPage()
  for (const path of shop) await check(p, 'guest', path, path.includes('nope123') && !path.startsWith('/order/'))
}
for (const role of roles) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
  const p = await ctx.newPage()
  await p.goto(BASE + '/dashboard/signin')
  await p.fill('input[name=email]', people[role].email)
  await p.fill('input[name=password]', people[role].password)
  await Promise.all([p.waitForURL(u => !u.pathname.includes('signin'), { timeout: 30000 }), p.click('button[type=submit]')])
  for (const path of staffPaths) await check(p, role, path, false)
  for (const path of nope) await check(p, role, path, true)
  await ctx.close()
}
await b.close()
console.log(`CHECK all pages: ${bad ? 'FAIL' : 'PASS'} (${n - bad}/${n})`)
