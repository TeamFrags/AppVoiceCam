import { defaultRoute } from '@/i18n/route';
import { admin } from '@/views/auth';

const route = defaultRoute(admin);
export const metadata = route.metadata;
export default route.Page;
