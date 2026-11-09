import { notFound, permanentRedirect } from 'next/navigation';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

// Every path under /shareables. With shareablesToLab on, it answers a permanent redirect to /lab; off, it is a 404
// as it is today.
export default function ShareablesSubpage() {
  if (FEATURE_FLAGS.shareablesToLab) permanentRedirect('/lab');
  notFound();
}
