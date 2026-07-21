/**
 * The feature registry.
 *
 * Single source of truth for who owns what, what's done, and what blocks what.
 * The dashboard at /implementation renders this, and docs/05_task_distribution.md
 * points here rather than repeating it — a status table in a markdown file goes
 * stale within a day.
 *
 * Update your row's `status` as you go. It costs five seconds and it's how the
 * other four people know whether they can stop stubbing your contract.
 */

export type FeatureStatus =
  /** Nobody has started. */
  | 'todo'
  /** Being built. The contract in `provides` may still move. */
  | 'building'
  /** Contract is frozen and the harness works. Others can depend on it for real. */
  | 'ready'
  /** Wired into the real /app routes. The harness stays for demos and debugging. */
  | 'unified'

export type Feature = {
  slug: string
  name: string
  owner: string
  status: FeatureStatus
  /** What this feature does, in one line, from the user's point of view. */
  summary: string
  /** Slugs this cannot be finished without. Keep it honest. */
  dependsOn: string[]
  /**
   * The modules this feature owns outright. Nobody else edits these without
   * asking. If two features want the same file, one of them is scoped wrong.
   */
  owns: string[]
  /**
   * The contract this publishes for everyone else: exported functions and types
   * other features may call. Freeze this EARLY, even returning mock data —
   * it's what unblocks the people downstream of you.
   */
  provides: string[]
  /** Which registered eGovPH APIs this exercises. Drives the integration story. */
  apis: string[]
  /** Which act of the demo script this appears in. */
  act?: string
}

export const FEATURES: Feature[] = [
  // ============================================ JASMIN — presentation layer
  {
    slug: 'brandkit',
    name: 'Brand kit & UI primitives',
    owner: 'Jasmin',
    status: 'building',
    summary:
      'Design tokens, UI primitives, and the LGU letterhead/seal assets every issued document uses.',
    dependsOn: [],
    owns: ['src/components/ui.tsx', 'src/app/globals.css', 'public/brand/'],
    provides: ['Card, Button, Badge, Field, SourceBadge, StatusBadge', 'CSS tokens in globals.css'],
    apis: [],
  },
  {
    slug: 'egov-shell',
    name: 'Mock eGovPH app shell',
    owner: 'Jasmin',
    status: 'todo',
    summary:
      'The eGovPH super-app wrapper a citizen sees: dashboard, LGUs tab, LGU search, and the live service list per LGU.',
    dependsOn: ['brandkit'],
    owns: ['src/app/(citizen)/', 'src/components/shell/'],
    provides: ['The citizen-facing navigation surface'],
    apis: [],
    act: 'Act 3',
  },
  {
    slug: 'citizen-apply',
    name: 'Citizen request flow UI',
    owner: 'Jasmin',
    status: 'todo',
    summary:
      'Dynamic form rendered from lgu_services.form_fields, with eVerify prefill, document upload, and submission.',
    dependsOn: ['egov-shell', 'everify', 'egov-pay'],
    owns: ['src/app/apply/', 'src/components/form/'],
    provides: ['<DynamicForm fields={FormField[]} />'],
    apis: [],
    act: 'Act 3',
  },

  // =================================================== JOSHUA — identity chain
  {
    slug: 'egov-sso',
    name: 'eGovPH Single Sign-On',
    owner: 'Joshua',
    status: 'building',
    summary:
      'Widget-based SSO returning an exchange_code, swapped server-side for a profile. One provider, two roles.',
    dependsOn: [],
    owns: ['src/lib/egov/sso.ts', 'src/lib/auth/', 'src/app/api/auth/egov/'],
    provides: [
      'getSession(), requireRole() — src/lib/auth/session.ts',
      'exchangeCode() → EgovProfile',
    ],
    apis: ['eGOV PH'],
    act: 'Act 1',
  },
  {
    slug: 'face-liveness',
    name: 'Face liveness check',
    owner: 'Joshua',
    status: 'building',
    summary:
      'Browser SDK liveness capture yielding a session_id. Hard prerequisite for eVerify — not an optional extra step.',
    dependsOn: ['egov-sso'],
    owns: ['src/lib/egov/liveness.ts', 'src/components/liveness/'],
    provides: ['createLivenessSession(), getLivenessResult() → session_id + score'],
    apis: ['FACE LIVENESS'],
    act: 'Act 3',
  },
  {
    slug: 'everify',
    name: 'eVerify identity pull',
    owner: 'Joshua',
    status: 'todo',
    summary:
      'Verifies against PhilSys using the liveness session_id, returning the demographics that prefill every form.',
    dependsOn: ['face-liveness'],
    owns: ['src/lib/egov/everify.ts'],
    provides: ['verifyIdentity(), verifyByQr() → VerifiedIdentity'],
    apis: ['#NationalID | eVerify'],
    act: 'Act 3',
  },

  // ================================================ DAVID — AI Studio & rules
  {
    slug: 'ai-studio',
    name: 'AI eService Studio',
    owner: 'David',
    status: 'unified',
    summary:
      'Natural-language prompt in, a complete eService schema out: fields, fee rules, required docs, approval routing.',
    dependsOn: [],
    owns: ['src/lib/studio/', 'src/lib/egov/ai.ts', 'src/app/console/studio/'],
    provides: ['generateService(prompt, lgu) → GeneratedService'],
    apis: ['eGov AI'],
    act: 'Act 2',
  },
  {
    slug: 'validation-rules',
    name: 'Bounded validation & flagging',
    owner: 'David',
    status: 'ready',
    summary:
      'Checks a generated config against its DICT template. Conforming services publish fast; anomalies route to a human.',
    dependsOn: [],
    owns: ['src/lib/rules/'],
    provides: ['validateService(service, template) → ValidationFlag[]'],
    apis: [],
    act: 'Act 2',
  },
  {
    slug: 'doc-extract',
    name: 'Paper form extraction',
    owner: 'David',
    status: 'ready',
    summary:
      'Upload an existing paper form as an alternative to prompting. Extractor returns HTML, which we parse into fields.',
    dependsOn: ['ai-studio'],
    owns: ['src/lib/studio/extract.ts'],
    provides: ['extractDocument(file) → ExtractedField[]'],
    apis: ['eGov AI'],
    act: 'Act 2',
  },

  // ================================================= EARL — issuance & proof
  {
    slug: 'doc-issuance',
    name: 'Automated PDF issuance',
    owner: 'Earl',
    status: 'unified',
    summary:
      "On approval, fills the LGU's template with verified data — letterhead, seal, control number, QR. Officer retypes nothing.",
    dependsOn: [],
    owns: ['src/lib/pdf/', 'src/app/api/issue/'],
    provides: ['generateDocument(request) → { pdf, hash, controlNumber }'],
    apis: [],
    act: 'Act 4',
  },
  {
    slug: 'egov-chain',
    name: 'Blockchain anchoring',
    owner: 'Earl',
    status: 'ready',
    summary:
      'Anchors each issued PDF hash on-chain so a bank or employer can confirm authenticity without calling the barangay.',
    dependsOn: ['doc-issuance'],
    owns: ['src/lib/egov/chain.ts'],
    provides: ['anchorHash(), verifyAnchor()'],
    apis: ['eGOV chain'],
    act: 'Act 4',
  },
  {
    slug: 'verify-qr',
    name: 'Public QR verification',
    owner: 'Earl',
    status: 'unified',
    summary:
      'Scan the QR on any issued document and see it confirmed or rejected, including the tamper case. The 30-second demo loop.',
    dependsOn: ['egov-chain'],
    owns: ['src/app/verify/'],
    provides: [],
    apis: ['eGOV chain'],
    act: 'Act 5',
  },

  // ============================================ ELTON — transactions & LGU ops
  {
    slug: 'lgu-onboarding',
    name: 'LGU registration',
    owner: 'Elton',
    status: 'unified',
    summary:
      'Register a real LGU against the PSA geographic reference, then land on its empty service dashboard.',
    dependsOn: ['egov-sso'],
    owns: ['src/app/console/register/', 'src/app/api/lgus/', 'supabase/seed_psgc.sql'],
    provides: ['searchPsgc(query) → PsgcEntry[]'],
    apis: [],
    act: 'Act 1',
  },
  {
    slug: 'egov-pay',
    name: 'Fee assessment & payment',
    owner: 'Elton',
    status: 'unified',
    summary:
      'Applies waivers, then charges the configured fee through eGovPay. A named stage in the core flow — cannot be dropped.',
    dependsOn: [],
    owns: ['src/lib/egov/pay.ts', 'src/app/pay/', 'src/app/api/pay/'],
    provides: ['generatePayment(), checkPayment(), voidPayment()'],
    apis: ['eGOV PAY'],
    act: 'Act 3',
  },
  {
    slug: 'approval-queue',
    name: 'Officer approval queue',
    owner: 'Elton',
    status: 'unified',
    summary:
      'Requests routed to the office the service names. Approving triggers issuance, anchoring, and the SMS.',
    dependsOn: ['egov-sso'],
    owns: ['src/app/console/requests/', 'src/app/api/requests/'],
    provides: ['approveRequest(id, officer)'],
    apis: [],
    act: 'Act 4',
  },
  {
    slug: 'emessage',
    name: 'SMS notification',
    owner: 'Elton',
    status: 'unified',
    summary:
      '"Your clearance is ready" — removes the return trip to the hall. Cleanest impact story in the project.',
    dependsOn: ['doc-issuance'],
    owns: ['src/lib/egov/emessage.ts'],
    provides: ['pushSms(), issuedSmsBody()'],
    apis: ['eMessage'],
    act: 'Act 4',
  },
  {
    slug: 'analytics',
    name: 'Live service analytics',
    owner: 'Elton',
    status: 'unified',
    summary:
      'Per-service volume, completion rate, and time-to-issue for the LGU department head. CUTTABLE if time runs short.',
    dependsOn: ['approval-queue', 'brandkit'],
    owns: ['src/app/console/analytics/'],
    provides: [],
    apis: [],
    act: 'Act 2',
  },
]

export function getFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug)
}

/** Features that list `slug` as a dependency — i.e. who you unblock by finishing. */
export function dependents(slug: string): Feature[] {
  return FEATURES.filter((f) => f.dependsOn.includes(slug))
}

/**
 * A dependency is "satisfied" once its contract is frozen, not once it's wired
 * into /app. That distinction is the whole point of stubbing contracts early.
 */
export function isBlocked(feature: Feature): boolean {
  return feature.dependsOn.some((slug) => {
    const dep = getFeature(slug)
    return !dep || (dep.status !== 'ready' && dep.status !== 'unified')
  })
}

export function featuresByOwner(): Map<string, Feature[]> {
  const map = new Map<string, Feature[]>()
  for (const feature of FEATURES) {
    const existing = map.get(feature.owner)
    if (existing) existing.push(feature)
    else map.set(feature.owner, [feature])
  }
  return map
}

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  todo: 'Not started',
  building: 'Building',
  ready: 'Contract frozen',
  unified: 'Live in /app',
}
