/** Refund & Cancellation Policy — in-app copy of the website's refund-policy.html. */
import { LegalDoc } from '@/features/legal/LegalDoc';
import { REFUND } from '@/features/legal/documents/refund';

export default function RefundScreen() {
  return <LegalDoc doc={REFUND} />;
}
