/** Community Guidelines — in-app copy of the website's community.html. */
import { LegalDoc } from '@/features/legal/LegalDoc';
import { COMMUNITY } from '@/features/legal/documents/community';

export default function CommunityScreen() {
  return <LegalDoc doc={COMMUNITY} />;
}
