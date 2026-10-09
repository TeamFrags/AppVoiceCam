import { defaultRoute } from '@/i18n/route';
import { verifyEmail } from '@/views/auth';

const route = defaultRoute(verifyEmail);
export const metadata = route.metadata;
export default route.Page;
