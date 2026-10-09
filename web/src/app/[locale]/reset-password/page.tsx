import { localeRoute } from '@/i18n/route';
import { resetPassword } from '@/views/auth';

const route = localeRoute(resetPassword);
export const generateMetadata = route.generateMetadata;
export default route.Page;
