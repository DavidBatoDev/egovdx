'use client'

import { useState, useRef } from 'react'
import { Button, Card, CardBody, CardHeader, Field, inputClass } from '@/components/ui'

export default function VerifyForm() {
  const [hash, setHash] = useState('')
  const [controlNumber, setControlNumber] = useState('')
  const [fileStatus, setFileStatus] = useState<'idle' | 'hashing' | 'done'>('idle')
  const [fileHash, setFileHash] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setFileStatus('hashing')
    setFileHash(null)
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      setFileHash(hex)
      setFileStatus('done')
    } catch {
      setFileStatus('idle')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Verify a Document</h1>
        <p className="mt-2 text-sm text-muted">
          Confirm a government-issued document is authentic and its hash is anchored on the
          blockchain.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Verify by Hash or Document ID"
          description="Paste the SHA-256 hash or the document UUID from the verification QR."
        />
        <CardBody className="space-y-4">
          <Field label="Document Hash or ID">
            <input
              className={inputClass}
              placeholder="64-char SHA-256 hex or UUID"
              value={hash}
              onChange={(e) => setHash(e.target.value.trim())}
            />
          </Field>
          <Button
            variant="primary"
            disabled={hash.length < 32}
            onClick={() => {
              if (hash) window.location.href = `/verify/${hash}`
            }}
          >
            Verify
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Verify by Control Number"
          description="Enter the control number printed on the document (e.g. BRGY-2026-000001)."
        />
        <CardBody className="space-y-4">
          <Field label="Control Number">
            <input
              className={inputClass}
              placeholder="BRGY-2026-000001"
              value={controlNumber}
              onChange={(e) => setControlNumber(e.target.value.trim())}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={!controlNumber}
            onClick={() => {
              if (controlNumber)
                window.location.href = `/api/verify/control?cn=${encodeURIComponent(controlNumber)}`
            }}
          >
            Look up
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Upload PDF — Tamper Test"
          description="Upload the issued PDF. We hash the file and check it against our records. Any modification will produce a different hash and fail verification."
        />
        <CardBody className="space-y-4">
          <Field label="PDF file">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-xs file:font-medium file:text-brand`}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </Field>

          {fileStatus === 'hashing' && (
            <p className="text-sm text-muted">Computing SHA-256…</p>
          )}

          {fileStatus === 'done' && fileHash && (
            <div className="space-y-3">
              <div className="rounded-lg bg-background px-3 py-2">
                <p className="text-xs text-muted">SHA-256 of uploaded file:</p>
                <p className="break-all font-mono text-xs text-foreground">{fileHash}</p>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  window.location.href = `/verify/${fileHash}`
                }}
              >
                Check against records
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-center text-xs text-muted">
        Powered by{' '}
        <span className="font-semibold text-brand">eSee LGU</span> · eGOV chain (Hyperledger Besu,
        Chain ID 13371)
      </p>
    </div>
  )
}
