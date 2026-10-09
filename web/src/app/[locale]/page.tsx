import { localeRoute } from '@/i18n/route';
import { home } from '@/views/Home';

const route = localeRoute(home);
export const generateMetadata = route.generateMetadata;
export default route.Page;
