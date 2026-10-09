import { localeRoute } from '@/i18n/route';
import { login } from '@/views/auth';

const route = localeRoute(login);
export const generateMetadata = route.generateMetadata;
export default route.Page;
