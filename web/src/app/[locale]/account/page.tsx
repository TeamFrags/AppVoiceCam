import { localeRoute } from '@/i18n/route';
import { account } from '@/views/auth';

const route = localeRoute(account);
export const generateMetadata = route.generateMetadata;
export default route.Page;
