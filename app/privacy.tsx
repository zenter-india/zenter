/** Privacy Policy — in-app copy of the website's privacy.html. */
import { LegalDoc } from '@/features/legal/LegalDoc';
import { PRIVACY } from '@/features/legal/documents/privacy';

export default function PrivacyScreen() {
  return <LegalDoc doc={PRIVACY} />;
}
