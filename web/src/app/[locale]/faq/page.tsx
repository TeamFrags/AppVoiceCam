import { localeRoute } from '@/i18n/route';
import { faq } from '@/views/Faq';

const route = localeRoute(faq);
export const generateMetadata = route.generateMetadata;
export default route.Page;
