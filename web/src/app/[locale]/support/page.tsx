import { localeRoute } from '@/i18n/route';
import { support } from '@/views/Support';

const route = localeRoute(support);
export const generateMetadata = route.generateMetadata;
export default route.Page;
