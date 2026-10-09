import { localeRoute } from '@/i18n/route';
import { terms } from '@/views/legal';

const route = localeRoute(terms);
export const generateMetadata = route.generateMetadata;
export default route.Page;
