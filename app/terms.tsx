/** Terms and Conditions — in-app copy of the website's terms.html. */
import { LegalDoc } from '@/features/legal/LegalDoc';
import { TERMS } from '@/features/legal/documents/terms';

export default function TermsScreen() {
  return <LegalDoc doc={TERMS} />;
}
