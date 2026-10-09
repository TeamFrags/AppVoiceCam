import { defaultRoute } from '@/i18n/route';
import { faq } from '@/views/Faq';

const route = defaultRoute(faq);
export const metadata = route.metadata;
export default route.Page;
