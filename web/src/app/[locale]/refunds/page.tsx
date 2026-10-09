import { localeRoute } from '@/i18n/route';
import { refunds } from '@/views/legal';

const route = localeRoute(refunds);
export const generateMetadata = route.generateMetadata;
export default route.Page;
