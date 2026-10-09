import { localeRoute } from '@/i18n/route';
import { forgotPassword } from '@/views/auth';

const route = localeRoute(forgotPassword);
export const generateMetadata = route.generateMetadata;
export default route.Page;
