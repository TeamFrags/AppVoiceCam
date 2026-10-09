import { localeRoute } from '@/i18n/route';
import { register } from '@/views/auth';

const route = localeRoute(register);
export const generateMetadata = route.generateMetadata;
export default route.Page;
