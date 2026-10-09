import { localeRoute } from '@/i18n/route';
import { verifyEmail } from '@/views/auth';

const route = localeRoute(verifyEmail);
export const generateMetadata = route.generateMetadata;
export default route.Page;
