import { AGE_BLOCKED_MESSAGE, AGE_TICK_LABEL } from '@/lib/legal-copy';

// Sign-up age gate. When the visitor cannot confirm, the form shows the adults-only message instead.
export function AgeConfirm({ canConfirm, name = 'age_confirmed' }: { canConfirm: boolean; name?: string }) {
  if (!canConfirm) {
    return <p className="font-body text-sm text-gray-600">{AGE_BLOCKED_MESSAGE}</p>;
  }
  return (
    <label className="font-body text-sm text-dark flex items-start gap-2">
      <input type="checkbox" name={name} required className="mt-1" />
      <span>{AGE_TICK_LABEL}</span>
    </label>
  );
}
