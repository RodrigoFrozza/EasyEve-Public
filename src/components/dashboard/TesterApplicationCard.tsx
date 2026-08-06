'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FlaskConical, Hourglass, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border text-foreground text-[10px] font-medium rounded-sm shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 text-primary/60" />
        Tester active
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Dialog open={open} onOpenChange={(value) => { if (isPending && value) return; setOpen(value) }}>
        <DialogTrigger asChild>
          {isPending ? (
            <Button
              variant="outline"
              disabled
              className="rounded-sm border-border bg-muted/50 text-muted-foreground text-[10px] font-medium opacity-80 cursor-not-allowed h-10 px-4 shadow-sm"
            >
              <Hourglass className="w-3.5 h-3.5 mr-2 animate-pulse text-muted-foreground/40" />
              Pending review
            </Button>
          ) : (
            <Button
              onClick={() => setOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-sm px-6 h-10 border border-primary transition-colors shadow-md active:scale-95"
            >
              <FlaskConical className="w-3.5 h-3.5 mr-2" />
              Apply as tester
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl bg-card border border-border rounded-sm shadow-2xl text-card-foreground p-0 overflow-hidden">
          <DialogHeader className="border-b border-border p-6 bg-muted/30">
            <DialogTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="w-4 h-4 text-primary/60" />
              Tester Program Application
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-8">
            <p className="text-muted-foreground/60 text-xs">
              Apply to join the tester program. Participation requires consistent feedback and active testing of new features.
            </p>

            <div className="space-y-6">
              {loading ? (
                <p className="text-xs text-muted-foreground/40 animate-pulse">Loading...</p>
              ) : (
                <>
                  {isPending && (
                    <div className="border border-border bg-muted/40 p-4 space-y-2 text-xs rounded-sm shadow-inner">
                      <p className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Hourglass className="w-4 h-4 animate-pulse text-muted-foreground/40" />
                        Your application is under review
                      </p>
                      <p className="text-muted-foreground/60">
                        Submitted: {new Date(application.createdAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  {isRejected && application?.reviewNotes && (
                    <div className="border border-destructive/20 bg-destructive/5 p-4 space-y-2 text-xs rounded-sm shadow-sm">
                      <p className="text-destructive font-medium flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive/60" />
                        Application rejected
                      </p>
                      <p className="text-destructive/80">Reason: {application.reviewNotes}</p>
                      {application.cooldownUntil && (
                        <p className="text-destructive/60">You can reapply after {new Date(application.cooldownUntil).toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Your motivation</p>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Tell us why you'd like to be a tester and your testing experience..."
                      className="min-h-[150px] bg-muted/20 border-border rounded-sm focus:ring-1 focus:ring-primary/20 transition-all text-xs text-foreground placeholder:text-muted-foreground/30 shadow-inner"
                    />
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[10px] text-muted-foreground/40">Minimum 80 characters</p>
                      <p className={cn("text-[10px]", description.length >= 80 ? "text-primary/60" : "text-muted-foreground/40")}>
                        {description.length} characters
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Program rules</p>
                    <div className="space-y-2 border border-border p-4 bg-muted/20 rounded-sm shadow-inner">
                      {(data?.rules || []).map((rule, index) => (
                        <label key={rule} className="flex items-start gap-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group/rule">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-border bg-card text-primary focus:ring-primary/20 focus:ring-offset-0 transition-all"
                            checked={Boolean(ruleChecks[index])}
                            onChange={(event) =>
                              setRuleChecks((previous) => {
                                const previousArray = [...previous]
                                previousArray[index] = event.target.checked
                                return previousArray
                              })
                            }
                          />
                          <span className="leading-tight group-hover/rule:translate-x-0.5 transition-transform">{rule}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-sm font-medium shadow-sm">
                      Error: {error}
                    </div>
                  )}
                  
                  <Button 
                    onClick={submit} 
                    disabled={!canSubmit}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-sm h-12 text-xs transition-all disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground disabled:border-border border border-primary shadow-lg active:scale-[0.98]"
                  >
                    {submitting ? 'Submitting...' : 'Submit application'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
