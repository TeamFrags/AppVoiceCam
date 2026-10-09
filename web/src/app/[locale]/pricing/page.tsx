import { localeRoute } from '@/i18n/route';
import { pricing } from '@/views/Pricing';

const route = localeRoute(pricing);
export const generateMetadata = route.generateMetadata;
export default route.Page;
