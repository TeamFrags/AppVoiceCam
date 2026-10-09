import { localeRoute } from '@/i18n/route';
import { admin } from '@/views/auth';

const route = localeRoute(admin);
export const generateMetadata = route.generateMetadata;
export default route.Page;
