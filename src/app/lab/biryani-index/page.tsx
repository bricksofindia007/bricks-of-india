import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { BiryaniCalculator } from './BiryaniCalculator';

export const metadata: Metadata = buildMetadata({
  title: 'The Biryani Index — The Lab',
  description: 'Convert any LEGO set price into everyday Indian-life equivalents — biryanis, chai, petrol, and more.',
  path: '/lab/biryani-index',
});

export default function BiryaniIndexPage() {
  return <BiryaniCalculator />;
}
