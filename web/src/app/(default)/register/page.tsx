import { defaultRoute } from '@/i18n/route';
import { register } from '@/views/auth';

const route = defaultRoute(register);
export const metadata = route.metadata;
export default route.Page;
