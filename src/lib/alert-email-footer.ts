import { ALERT_FOOTER_TEMPLATE } from '@/lib/legal-copy';

// Footer for every alert email. The caller passes the two links for each recipient.
export function alertEmailFooter({ unsubscribe, deleteAccount }: { unsubscribe: string; deleteAccount: string }): string {
  return ALERT_FOOTER_TEMPLATE.replace('{unsubscribe}', unsubscribe).replace('{delete}', deleteAccount);
}
