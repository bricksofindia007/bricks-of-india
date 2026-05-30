import { redirect } from 'next/navigation';

interface Props {
  params: { page: string };
}

// /sets/page/[page] is now superseded by /sets?page=N.
// Redirect permanently so any bookmarks or external links still work.
export default function SetsPageNRedirect({ params }: Props) {
  const n = parseInt(params.page);
  if (isNaN(n) || n < 2) redirect('/sets');
  redirect(`/sets?page=${n}`);
}
