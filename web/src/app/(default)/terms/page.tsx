import { defaultRoute } from '@/i18n/route';
import { terms } from '@/views/legal';

const route = defaultRoute(terms);
export const metadata = route.metadata;
export default route.Page;
