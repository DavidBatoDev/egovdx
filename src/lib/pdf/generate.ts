import 'server-only'
import { createHash } from 'node:crypto'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import type { RequestWithService } from '@/lib/data'
import { controlNumber, dateOnly } from '@/lib/format'

/**
 * Generate a government-issued PDF document.
 *
 * Hash ordering — critical to get right:
 *   1. Render full PDF including QR (which embeds the request URL)
 *   2. SHA-256 the final bytes → doc_hash
 *   3. Anchor doc_hash on-chain
 *
 * The QR in the PDF points to /verify/<requestId>. That page shows the document
 * record AND lets a visitor verify the file-integrity hash against the chain.
 * Uploading the original PDF and hashing it on the verify page will match
 * doc_hash. An altered PDF produces a different hash → ✗.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

export type IssuedDocument = {
  pdf: Uint8Array
  /** SHA-256 hex of the FINAL PDF bytes (with QR embedded). */
  hash: string
  controlNumber: string
}

export async function generateDocument(request: RequestWithService): Promise<IssuedDocument> {
  const service = request.service
  const lgu = service.lgu

  // Determine control number — use existing if the request already has one.
  const ctrlNum =
    request.control_number ??
    controlNumber(service.template.code, Math.floor(Math.random() * 99999) + 1)

  const citizenName = extractCitizenName(request)
  const issuedDate = dateOnly(request.issued_at ?? new Date().toISOString())

  const doc = await PDFDocument.create()
  const page = doc.addPage([A4_WIDTH, A4_HEIGHT])

  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique)

  const { width, height } = page.getSize()
  const margin = 56
  const contentWidth = width - margin * 2

  let y = height - margin

  // ── header ──────────────────────────────────────────────────────────────────
  // LGU seal (if available in storage URL)
  if (lgu && 'seal_url' in lgu && lgu.seal_url) {
    try {
      const sealRes = await fetch(lgu.seal_url as string)
      const sealBytes = new Uint8Array(await sealRes.arrayBuffer())
      const sealImage = await doc.embedPng(sealBytes).catch(() => doc.embedJpg(sealBytes))
      page.drawImage(sealImage, { x: margin, y: y - 60, width: 56, height: 56 })
    } catch {
      // seal unavailable — continue without it
    }
  }

  // Republic of the Philippines header
  page.drawText('Republic of the Philippines', {
    x: margin + 70,
    y,
    size: 9,
    font: regularFont,
    color: rgb(0.3, 0.3, 0.3),
  })
  y -= 14
  page.drawText(lgu ? `${lgu.name.toUpperCase()}` : 'LOCAL GOVERNMENT UNIT', {
    x: margin + 70,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.05, 0.2, 0.5),
  })
  y -= 14
  page.drawText('Office of the Local Government', {
    x: margin + 70,
    y,
    size: 9,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Divider
  y -= 20
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1.5,
    color: rgb(0.05, 0.2, 0.5),
  })
  y -= 4
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.05, 0.2, 0.5),
  })

  // ── document title ───────────────────────────────────────────────────────────
  y -= 28
  const titleText = service.template.name.toUpperCase()
  const titleWidth = boldFont.widthOfTextAtSize(titleText, 16)
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.05, 0.2, 0.5),
  })
  y -= 12
  page.drawText(`Control No.: ${ctrlNum}`, {
    x: width - margin - regularFont.widthOfTextAtSize(`Control No.: ${ctrlNum}`, 9),
    y,
    size: 9,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  // ── salutation ───────────────────────────────────────────────────────────────
  y -= 32
  page.drawText('TO WHOM IT MAY CONCERN:', {
    x: margin,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  })

  // ── body ─────────────────────────────────────────────────────────────────────
  y -= 20
  const bodyLines = buildBodyLines(service.template.code, citizenName, request)
  for (const line of bodyLines) {
    drawWrapped(page, line.text, {
      x: margin,
      y,
      size: line.size ?? 10,
      font: line.bold ? boldFont : regularFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: contentWidth,
      lineHeight: 16,
    })
    const estimatedLines = Math.ceil(
      (line.bold ? boldFont : regularFont).widthOfTextAtSize(line.text, line.size ?? 10) /
        contentWidth,
    )
    y -= Math.max(estimatedLines * 16, 18)
  }

  // ── verified data ────────────────────────────────────────────────────────────
  y -= 10
  page.drawText('Verified Identity (eVerify / PhilSys)', {
    x: margin,
    y,
    size: 8,
    font: boldFont,
    color: rgb(0.05, 0.2, 0.5),
  })
  y -= 4
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 220, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })
  y -= 14

  const payload = (request.everify_payload ?? {}) as Record<string, string>
  const verifiedFields: [string, string][] = [
    ['Full Name', payload.full_name ?? citizenName],
    ['Date of Birth', payload.birth_date ?? '—'],
    ['Address', payload.full_address ?? payload.present_full_address ?? '—'],
  ]
  for (const [label, value] of verifiedFields) {
    page.drawText(`${label}:`, { x: margin, y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(truncate(value, 70), {
      x: margin + 90,
      y,
      size: 9,
      font: regularFont,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= 14
  }

  // ── form data ─────────────────────────────────────────────────────────────────
  if (Object.keys(request.form_data ?? {}).length > 0) {
    y -= 6
    page.drawText('Submitted Information', {
      x: margin,
      y,
      size: 8,
      font: boldFont,
      color: rgb(0.05, 0.2, 0.5),
    })
    y -= 4
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + 220, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    })
    y -= 14

    for (const [key, val] of Object.entries(request.form_data ?? {})) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      page.drawText(`${label}:`, {
        x: margin,
        y,
        size: 9,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(truncate(String(val), 70), {
        x: margin + 120,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0.1, 0.1, 0.1),
      })
      y -= 14
    }
  }

  // ── certification block ───────────────────────────────────────────────────────
  y -= 16
  drawWrapped(
    page,
    'This certification is issued upon the request of the above-named person for whatever legal purpose it may serve.',
    {
      x: margin,
      y,
      size: 9,
      font: italicFont,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: contentWidth,
      lineHeight: 14,
    },
  )
  y -= 30
  page.drawText(`Issued on: ${issuedDate}`, {
    x: margin,
    y,
    size: 9,
    font: regularFont,
    color: rgb(0.2, 0.2, 0.2),
  })

  // ── signature block ───────────────────────────────────────────────────────────
  y -= 48
  const sigX = width - margin - 180
  page.drawLine({
    start: { x: sigX, y: y + 30 },
    end: { x: sigX + 160, y: y + 30 },
    thickness: 0.75,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText('Authorized Signatory', {
    x: sigX + 30,
    y: y + 18,
    size: 8,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })
  const approvalOffice = service.approval_office ?? 'Office of the Local Government'
  page.drawText(truncate(approvalOffice, 30), {
    x: sigX + 10,
    y: y + 6,
    size: 7,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  // ── footer / chain info ───────────────────────────────────────────────────────
  const footerY = 48
  page.drawLine({
    start: { x: margin, y: footerY + 16 },
    end: { x: width - margin, y: footerY + 16 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  page.drawText('This document was digitally issued via eSee LGU powered by eGovPH.', {
    x: margin,
    y: footerY + 6,
    size: 7,
    font: italicFont,
    color: rgb(0.55, 0.55, 0.55),
  })
  page.drawText('Scan the QR code to verify authenticity on the blockchain.', {
    x: margin,
    y: footerY - 4,
    size: 7,
    font: italicFont,
    color: rgb(0.55, 0.55, 0.55),
  })

  // ── QR code ───────────────────────────────────────────────────────────────────
  const verifyUrl = `${APP_URL}/verify/${request.id}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 120,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
  const qrBytes = Buffer.from(qrBase64, 'base64')
  const qrImage = await doc.embedPng(qrBytes)
  const qrSize = 90
  page.drawImage(qrImage, {
    x: width - margin - qrSize,
    y: footerY - 10,
    width: qrSize,
    height: qrSize,
  })
  page.drawText('Verify', {
    x: width - margin - qrSize + 30,
    y: footerY - 16,
    size: 7,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  // ── serialise & hash ──────────────────────────────────────────────────────────
  const pdfBytes = await doc.save()
  const hash = createHash('sha256').update(pdfBytes).digest('hex')

  return { pdf: pdfBytes, hash, controlNumber: ctrlNum }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractCitizenName(request: RequestWithService): string {
  if (request.citizen_name) return request.citizen_name
  const p = (request.everify_payload ?? {}) as Record<string, string>
  return p.full_name ?? 'Unknown Citizen'
}

type DrawLine = { text: string; size?: number; bold?: boolean }

function buildBodyLines(
  templateCode: string,
  citizenName: string,
  request: RequestWithService,
): DrawLine[] {
  const service = request.service
  const lguName = service.lgu.name
  const approvedOn = dateOnly(request.issued_at ?? new Date().toISOString())

  return [
    { text: '' },
    {
      text: `This is to certify that ${citizenName} is a bona fide resident of ${lguName} and has applied for the following service:`,
      size: 10,
    },
    { text: '' },
    { text: service.template.name, size: 11, bold: true },
    { text: '' },
    {
      text: `The application has been duly reviewed and approved by the concerned office as of ${approvedOn}.`,
      size: 10,
    },
  ]
}

type DrawOptions = {
  x: number
  y: number
  size: number
  font: import('pdf-lib').PDFFont
  color: import('pdf-lib').Color
  maxWidth: number
  lineHeight: number
}

function drawWrapped(page: import('pdf-lib').PDFPage, text: string, opts: DrawOptions): number {
  const words = text.split(' ')
  let line = ''
  let currentY = opts.y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (opts.font.widthOfTextAtSize(test, opts.size) > opts.maxWidth && line) {
      page.drawText(line, { x: opts.x, y: currentY, size: opts.size, font: opts.font, color: opts.color })
      currentY -= opts.lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) {
    page.drawText(line, { x: opts.x, y: currentY, size: opts.size, font: opts.font, color: opts.color })
    currentY -= opts.lineHeight
  }
  return currentY
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return `${str.slice(0, max - 1)}…`
}
