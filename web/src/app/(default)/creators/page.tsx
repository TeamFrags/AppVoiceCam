import { defaultRoute } from '@/i18n/route';
import { creators } from '@/views/Creators';

const route = defaultRoute(creators);
export const metadata = route.metadata;
export default route.Page;
