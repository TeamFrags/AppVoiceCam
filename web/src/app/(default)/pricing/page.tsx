import { defaultRoute } from '@/i18n/route';
import { pricing } from '@/views/Pricing';

const route = defaultRoute(pricing);
export const metadata = route.metadata;
export default route.Page;
