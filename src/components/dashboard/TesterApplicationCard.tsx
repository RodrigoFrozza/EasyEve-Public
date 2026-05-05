'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FlaskConical, Hourglass, CheckCircle2, XCircle } from 'lucide-react'

type TesterStatus = 'pending' | 'approved' | 'rejected'

interface TesterApplicationResponse {
  isTester: boolean
  rules: string[]
  application: {
    id: string
    status: TesterStatus
    reviewNotes: string | null
    cooldownUntil: string | null
    createdAt: string
  } | null
}

const initialRuleChecks = [false, false, false, false]

export function TesterApplicationCard() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [ruleChecks, setRuleChecks] = useState(initialRuleChecks)
  const [data, setData] = useState<TesterApplicationResponse | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/tester-applications/me', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load tester application status.')
      }
      setData(await response.json())
    } catch (err: any) {
      setError(err?.message || 'Failed to load tester status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const canSubmit = useMemo(() => {
    const hasAllRules = ruleChecks.every(Boolean)
    return hasAllRules && description.trim().length >= 80 && !submitting
  }, [description, ruleChecks, submitting])

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/tester-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          acceptedRules: ruleChecks.map((checked, index) => (checked ? index : -1)).filter((index) => index >= 0),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error?.message || body?.message || 'Failed to submit application.')
      }
      setDescription('')
      setRuleChecks(initialRuleChecks)
      await refresh()
      setOpen(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application.')
    } finally {
      setSubmitting(false)
    }
  }

  const application = data?.application

  const isPending = application?.status === 'pending'
  const isApproved = data?.isTester
  const isRejected = application?.status === 'rejected'

  if (isApproved) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-sm px-4 py-2">
        <CheckCircle2 className="w-4 h-4 mr-2" />
        Tester Active
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Dialog open={open} onOpenChange={(value) => { if (isPending && value) return; setOpen(value) }}>
        <DialogTrigger asChild>
          {isPending ? (
            <Button
              variant="secondary"
              disabled
              className="opacity-70 cursor-not-allowed bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/10"
            >
              <Hourglass className="w-4 h-4 mr-2 animate-pulse" />
              Application Pending
            </Button>
          ) : (
            <Button
              onClick={() => setOpen(true)}
              className="group relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300 border-0 px-6 py-3"
            >
              <FlaskConical className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
              Tester Program
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-400" />
              Tester Program
            </DialogTitle>
          </DialogHeader>
          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardDescription>
                Apply to get full access while helping improve EasyEve through ongoing testing and feedback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-0 pb-0">
              {loading ? (
                <p className="text-sm text-zinc-400">Loading tester program status...</p>
              ) : (
                <>
                  {isPending ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 text-sm">
                      <p className="flex items-center gap-2 text-amber-300 font-semibold">
                        <Hourglass className="w-4 h-4 animate-pulse" />
                        Application Under Review
                      </p>
                      <p className="text-zinc-400">
                        Submitted on {new Date(application.createdAt).toLocaleDateString()} — you can only have one active application at a time.
                      </p>
                    </div>
                  ) : null}
                  {isRejected && application?.reviewNotes ? (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1 text-sm">
                      <p className="text-red-300 font-semibold flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Application Rejected
                      </p>
                      <p className="text-zinc-400">Review notes: {application.reviewNotes}</p>
                      {application.cooldownUntil ? (
                        <p className="text-zinc-500 text-xs">You may reapply after: {new Date(application.cooldownUntil).toLocaleString()}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-200">Tell us about you and how you will help</p>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Describe your EVE activities, your testing routine, and how you plan to help improve EasyEve."
                      className="min-h-[130px]"
                    />
                    <p className="text-xs text-zinc-500">Minimum 80 characters.</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-200">Tester program rules</p>
                    {(data?.rules || []).map((rule, index) => (
                      <label key={rule} className="flex items-start gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={Boolean(ruleChecks[index])}
                          onChange={(event) =>
                            setRuleChecks((previous) => {
                              const next = [...previous]
                              next[index] = event.target.checked
                              return next
                            })
                          }
                        />
                        <span>{rule}</span>
                      </label>
                    ))}
                  </div>

                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                  <Button onClick={submit} disabled={!canSubmit}>
                    {submitting ? 'Submitting...' : 'Apply for Tester Program'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
     </div>
   )
 }
