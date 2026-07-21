/**
 * Browser QA runner — headed, slow, and watchable.
 *
 *   npm run qa                    # all flows
 *   npm run qa -- landing apply   # named flows only
 *   npm run qa -- --headless      # CI / no display
 *   npm run qa -- --slowmo 0      # full speed
 *
 * Runs headed at slowMo 800ms ON PURPOSE. The point is a human watching the
 * browser drive itself: a form that fills but looks wrong, a flash of an error
 * boundary, a layout that collapses — none of that shows up in a pass/fail line,
 * and all of it matters when the app is about to be screen-recorded.
 *
 * Every run also captures console errors and failed requests, which is where
 * hydration mismatches and 500s from route handlers actually surface.
 */

import { chromium } from 'playwright'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { flows } from './flows.mjs'

const ARTIFACT_DIR = 'qa-artifacts'
const DEFAULT_SLOWMO = 800

function parseArgs(argv) {
  const args = { slowMo: DEFAULT_SLOWMO, headless: false, only: [] }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--headless') args.headless = true
    else if (a === '--slowmo') args.slowMo = Number(argv[++i])
    else if (a === '--base') args.baseUrl = argv[++i]
    else if (!a.startsWith('-')) args.only.push(a)
  }

  args.baseUrl ??= process.env.QA_BASE_URL ?? 'http://localhost:3000'
  return args
}

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
}

async function serverIsUp(baseUrl) {
  try {
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) })
    return res.status < 500
  } catch {
    return false
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const selected = args.only.length
    ? flows.filter((f) => args.only.includes(f.id))
    : flows

  if (selected.length === 0) {
    console.error(`No flows matched. Available: ${flows.map((f) => f.id).join(', ')}`)
    process.exit(1)
  }

  if (!(await serverIsUp(args.baseUrl))) {
    console.error(
      `${C.red}Nothing responding at ${args.baseUrl}${C.reset}\n` +
        `Start the dev server first:  npm run dev`,
    )
    process.exit(1)
  }

  await rm(ARTIFACT_DIR, { recursive: true, force: true })
  await mkdir(ARTIFACT_DIR, { recursive: true })

  console.log(
    `\n${C.bold}Browser QA${C.reset} — ${selected.length} flow(s) against ${args.baseUrl}\n` +
      `${C.dim}${args.headless ? 'headless' : 'headed'}, slowMo ${args.slowMo}ms${C.reset}\n`,
  )

  const browser = await chromium.launch({
    headless: args.headless,
    slowMo: args.slowMo,
    args: ['--window-size=1440,900'],
  })

  const results = []

  for (const flow of selected) {
    // A fresh context per flow keeps cookies from leaking between them, which
    // matters because several flows assert on role-based routing.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()

    const consoleErrors = []
    const failedRequests = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300))
    })
    page.on('pageerror', (err) => consoleErrors.push(`[uncaught] ${err.message}`.slice(0, 300)))
    page.on('response', (res) => {
      if (res.status() >= 400) {
        failedRequests.push(`${res.status()} ${new URL(res.url()).pathname}`)
      }
    })

    let shotIndex = 0
    const shot = async (name) => {
      const file = `${ARTIFACT_DIR}/${flow.id}-${++shotIndex}-${name}.png`
      await page.screenshot({ path: file, fullPage: true })
    }

    process.stdout.write(`${C.blue}▶${C.reset} ${flow.name}\n`)
    const started = Date.now()

    try {
      const note = await flow.run({ page, baseUrl: args.baseUrl, shot })
      const ms = Date.now() - started

      // Console errors don't fail the flow, but they are exactly the class of
      // problem that looks fine on camera and breaks in the Q&A.
      results.push({
        flow,
        status: 'pass',
        ms,
        note,
        consoleErrors,
        failedRequests,
      })
      console.log(
        `  ${C.green}✓ pass${C.reset} ${C.dim}${ms}ms${note ? ` · ${note}` : ''}${C.reset}`,
      )
      if (consoleErrors.length) {
        console.log(`  ${C.yellow}⚠ ${consoleErrors.length} console error(s)${C.reset}`)
      }
    } catch (err) {
      const ms = Date.now() - started
      const message = err instanceof Error ? err.message : String(err)

      // A route that doesn't exist yet is PENDING, not FAILED. On a five-person
      // parallel build, reporting unwritten features as failures trains everyone
      // to ignore the report.
      //
      // This keys off an explicit flag thrown by visit(), not a guess at the
      // message text — a heuristic here would eventually misclassify a real
      // failure as "not built" and hide it.
      const notBuilt = err?.notBuilt === true

      await shot('failure').catch(() => {})

      results.push({
        flow,
        status: notBuilt ? 'pending' : 'fail',
        ms,
        message,
        consoleErrors,
        failedRequests,
      })

      if (notBuilt) {
        console.log(`  ${C.yellow}○ pending${C.reset} ${C.dim}route not built yet${C.reset}`)
      } else {
        console.log(`  ${C.red}✗ fail${C.reset} ${message.split('\n')[0].slice(0, 160)}`)
        if (failedRequests.length) {
          console.log(`  ${C.dim}  requests: ${[...new Set(failedRequests)].join(', ')}${C.reset}`)
        }
      }
    }

    await context.close()
  }

  await browser.close()

  // ------------------------------------------------------------- summary
  const passed = results.filter((r) => r.status === 'pass')
  const failed = results.filter((r) => r.status === 'fail')
  const pending = results.filter((r) => r.status === 'pending')

  console.log(`\n${'─'.repeat(64)}`)
  console.log(
    `${C.green}${passed.length} passed${C.reset} · ` +
      `${failed.length ? C.red : C.dim}${failed.length} failed${C.reset} · ` +
      `${C.yellow}${pending.length} pending${C.reset}`,
  )

  if (failed.length) {
    console.log(`\n${C.bold}Failures by owner:${C.reset}`)
    for (const r of failed) {
      console.log(`  ${C.red}${r.flow.owner}${C.reset} — ${r.flow.name}`)
      console.log(`    ${C.dim}${r.message.split('\n')[0].slice(0, 200)}${C.reset}`)
    }
  }

  if (pending.length) {
    console.log(
      `\n${C.dim}Pending (not built yet): ` +
        `${pending.map((r) => `${r.flow.id} [${r.flow.owner}]`).join(', ')}${C.reset}`,
    )
  }

  const withConsoleErrors = results.filter((r) => r.consoleErrors.length)
  if (withConsoleErrors.length) {
    console.log(`\n${C.yellow}${C.bold}Console errors${C.reset} ${C.dim}(not fatal, but fix before recording)${C.reset}`)
    for (const r of withConsoleErrors) {
      console.log(`  ${r.flow.id}:`)
      for (const e of [...new Set(r.consoleErrors)].slice(0, 3)) {
        console.log(`    ${C.dim}${e}${C.reset}`)
      }
    }
  }

  await writeFile(
    `${ARTIFACT_DIR}/report.json`,
    JSON.stringify(
      results.map((r) => ({
        id: r.flow.id,
        name: r.flow.name,
        owner: r.flow.owner,
        status: r.status,
        ms: r.ms,
        note: r.note ?? null,
        message: r.message ?? null,
        consoleErrors: [...new Set(r.consoleErrors)],
        failedRequests: [...new Set(r.failedRequests)],
      })),
      null,
      2,
    ),
  )

  console.log(`\n${C.dim}Screenshots + report.json in ./${ARTIFACT_DIR}/${C.reset}\n`)

  // Pending doesn't fail the run — only genuine breakage does.
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
