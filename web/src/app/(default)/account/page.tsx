import { defaultRoute } from '@/i18n/route';
import { account } from '@/views/auth';

const route = defaultRoute(account);
export const metadata = route.metadata;
export default route.Page;
