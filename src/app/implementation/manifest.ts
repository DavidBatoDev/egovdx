/**
 * The feature registry.
 *
 * Single source of truth for who owns what, what's done, and what blocks what.
 * The dashboard at /implementation renders this, and docs/04_implementation_workflow.md
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
  /** Slugs this cannot be finished without. Keep it honest — see `stubbing` in the docs. */
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
}

export const FEATURES: Feature[] = [
  // ---------------------------------------------------------- foundation
  {
    slug: 'brandkit',
    name: 'Brand kit & UI primitives',
    owner: 'unassigned',
    status: 'building',
    summary:
      'Design tokens, UI primitives, and the LGU letterhead/seal assets every issued document uses.',
    dependsOn: [],
    owns: ['src/components/ui.tsx', 'src/app/globals.css', 'public/brand/'],
    provides: ['Card, Button, Badge, Field, SourceBadge', 'CSS custom properties in globals.css'],
    apis: [],
  },
  {
    slug: 'egov-sso',
    name: 'eGovPH Single Sign-On',
    owner: 'unassigned',
    status: 'ready',
    summary:
      'One identity provider, two roles. eGovPH authenticates; the officers table authorizes.',
    dependsOn: [],
    owns: ['src/lib/egov/sso.ts', 'src/lib/auth/', 'src/app/api/auth/egov/'],
    provides: [
      'getSession(), requireRole() — src/lib/auth/session.ts',
      'exchangeCode() — src/lib/egov/sso.ts',
    ],
    apis: ['eGOV PH'],
  },

  // ------------------------------------------------------------ identity
  {
    slug: 'everify',
    name: 'eVerify identity pull',
    owner: 'unassigned',
    status: 'building',
    summary:
      'Pulls verified name, address, and residency from PhilSys so citizens never retype what government already holds.',
    dependsOn: ['egov-sso'],
    owns: ['src/lib/egov/everify.ts'],
    provides: ['verifyIdentity(), verifyByQr() → VerifiedIdentity'],
    apis: ['#NationalID | eVerify'],
  },
  {
    slug: 'face-liveness',
    name: 'Face liveness check',
    owner: 'unassigned',
    status: 'building',
    summary:
      'Confirms a live citizen is present at request time — what replaces the officer seeing them at the counter.',
    dependsOn: ['egov-sso'],
    owns: ['src/lib/egov/liveness.ts'],
    provides: ['createLivenessSession(), getLivenessResult()'],
    apis: ['FACE LIVENESS'],
  },

  // ------------------------------------------------------- configuration
  {
    slug: 'ai-extractor',
    name: 'Document field extraction',
    owner: 'unassigned',
    status: 'building',
    summary:
      "Reads an officer's existing paper form and proposes the field mapping. Without this, the config console is just manual data entry.",
    dependsOn: [],
    owns: ['src/lib/egov/ai.ts'],
    provides: ['extractDocument() → ExtractionResult', 'translate()'],
    apis: ['eGov AI'],
  },
  {
    slug: 'create-service',
    name: 'Officer configuration console',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Upload a form, confirm the mapped fields, set fee/waivers/eligibility from the bounded rule set, submit as draft.',
    dependsOn: ['egov-sso', 'ai-extractor', 'validation-rules'],
    owns: ['src/app/console/', 'src/app/api/services/'],
    provides: ['The lgu_services draft-writing path'],
    apis: ['eGov AI'],
  },
  {
    slug: 'validation-rules',
    name: 'Automated validation & flagging',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Checks a submitted config against its DICT template and writes flags. Conforming submissions publish fast; anomalies route to a human.',
    dependsOn: [],
    owns: ['src/lib/rules/'],
    provides: ['validateService(service, template) → ValidationFlag[]'],
    apis: [],
  },
  {
    slug: 'review-queue',
    name: 'DICT review queue',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Reviewer sees flagged configs with the specific rule each one broke, then publishes or rejects.',
    dependsOn: ['validation-rules', 'egov-sso'],
    owns: ['src/app/review/', 'src/app/api/review/'],
    provides: [],
    apis: [],
  },

  // ------------------------------------------------------------- citizen
  {
    slug: 'citizen-apply',
    name: 'Citizen request flow',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Prefilled from eVerify, liveness-checked, rendered dynamically from the LGU-configured field list.',
    dependsOn: ['everify', 'face-liveness', 'egov-sso'],
    owns: ['src/app/apply/', 'src/app/track/', 'src/app/api/requests/'],
    provides: ['The requests-writing path'],
    apis: ['#NationalID | eVerify', 'FACE LIVENESS'],
  },
  {
    slug: 'egov-pay',
    name: 'Fee assessment & payment',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Applies waivers, charges the configured fee. A named stage in the core flow, so it cannot be dropped.',
    dependsOn: ['citizen-apply'],
    owns: ['src/lib/egov/pay.ts', 'src/app/pay/'],
    provides: ['generatePayment(), checkPayment()'],
    apis: ['eGOV PAY'],
  },

  // ------------------------------------------------------------ issuance
  {
    slug: 'doc-issuance',
    name: 'Automated PDF issuance',
    owner: 'unassigned',
    status: 'todo',
    summary:
      "On approval, fills the LGU's own template with verified data — letterhead, seal, control number. The officer retypes nothing.",
    dependsOn: ['citizen-apply'],
    owns: ['src/lib/pdf/', 'src/app/api/issue/'],
    provides: ['generateDocument(request) → { pdf, hash, controlNumber }'],
    apis: [],
  },
  {
    slug: 'egov-chain',
    name: 'Blockchain anchoring',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Anchors each issued PDF hash on-chain so a bank or employer can confirm authenticity without calling the barangay.',
    dependsOn: ['doc-issuance'],
    owns: ['src/lib/egov/chain.ts'],
    provides: ['anchorHash(), verifyAnchor()'],
    apis: ['eGOV chain'],
  },
  {
    slug: 'verify-qr',
    name: 'Public QR verification',
    owner: 'unassigned',
    status: 'todo',
    summary:
      'Scan the QR on any issued document and see it confirmed or rejected. The 30-second demo loop.',
    dependsOn: ['doc-issuance', 'egov-chain'],
    owns: ['src/app/verify/'],
    provides: [],
    apis: ['eGOV chain'],
  },
  {
    slug: 'emessage',
    name: 'SMS notification',
    owner: 'unassigned',
    status: 'building',
    summary:
      '"Your clearance is ready" — removes the return trip to the hall. Cleanest impact story in the project.',
    dependsOn: ['doc-issuance'],
    owns: ['src/lib/egov/emessage.ts'],
    provides: ['pushSms(), issuedSmsBody()'],
    apis: ['eMessage'],
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

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  todo: 'Not started',
  building: 'Building',
  ready: 'Contract frozen',
  unified: 'Live in /app',
}
