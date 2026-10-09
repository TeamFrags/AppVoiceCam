import { defaultRoute } from '@/i18n/route';
import { login } from '@/views/auth';

const route = defaultRoute(login);
export const metadata = route.metadata;
export default route.Page;
