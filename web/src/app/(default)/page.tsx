import { defaultRoute } from '@/i18n/route';
import { home } from '@/views/Home';

const route = defaultRoute(home);
export const metadata = route.metadata;
export default route.Page;
