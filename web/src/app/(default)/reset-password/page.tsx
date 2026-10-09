import { defaultRoute } from '@/i18n/route';
import { resetPassword } from '@/views/auth';

const route = defaultRoute(resetPassword);
export const metadata = route.metadata;
export default route.Page;
