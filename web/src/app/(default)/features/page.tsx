import { defaultRoute } from '@/i18n/route';
import { features } from '@/views/Features';

const route = defaultRoute(features);
export const metadata = route.metadata;
export default route.Page;
