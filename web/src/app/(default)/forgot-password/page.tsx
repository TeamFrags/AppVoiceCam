import { defaultRoute } from '@/i18n/route';
import { forgotPassword } from '@/views/auth';

const route = defaultRoute(forgotPassword);
export const metadata = route.metadata;
export default route.Page;
