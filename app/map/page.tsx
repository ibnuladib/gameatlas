import { redirect } from 'next/navigation';

/** The semantic map lives at `/`. Keep `/map` as a redirect for old links. */
export default function MapPage() {
  redirect('/');
}
