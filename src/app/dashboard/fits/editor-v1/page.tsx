'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import FitsEditorV1 from '../../../../components/fits/FitsEditorV1'

export default function DeprecatedFitEditorPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 flex items-center gap-3 text-amber-100/90 text-xs">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden />
        <p className="font-medium">
          This is the deprecated internal fit editor (API v1). Use the{' '}
          <Link href="/dashboard/fits/editor" className="underline font-semibold hover:text-white">
            current editor
          </Link>{' '}
          unless you are verifying legacy behavior.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <FitsEditorV1 />
      </div>
    </div>
  )
}
