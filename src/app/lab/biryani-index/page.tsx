import type { Metadata } from 'next';
import { BiryaniCalculator } from './BiryaniCalculator';

export const metadata: Metadata = {
  title: 'The Biryani Index | Bricks of India Lab',
  description:
    'Convert any LEGO set price into everyday Indian-life equivalents — biryanis, chai, petrol, and more.',
  alternates: { canonical: 'https://bricksofindia.com/lab/biryani-index' },
};

export default function BiryaniIndexPage() {
  return <BiryaniCalculator />;
}
