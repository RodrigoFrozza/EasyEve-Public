import { redirect } from 'next/navigation'

/** Bookmark alias: fits v2 lives at `/dashboard/fits/editor`. */
export default function FitsV2AliasPage() {
  redirect('/dashboard/fits/editor')
}
