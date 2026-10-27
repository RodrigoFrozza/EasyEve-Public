import { redirect } from 'next/navigation'

/** Fit compare was removed; send users back to the fits dashboard. */
export default function FitCompareRemovedPage() {
  redirect('/dashboard/fits')
}
