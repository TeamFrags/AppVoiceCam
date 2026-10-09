import { defaultRoute } from '@/i18n/route';
import { refunds } from '@/views/legal';

const route = defaultRoute(refunds);
export const metadata = route.metadata;
export default route.Page;
