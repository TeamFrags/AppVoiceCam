import { localeRoute } from '@/i18n/route';
import { features } from '@/views/Features';

const route = localeRoute(features);
export const generateMetadata = route.generateMetadata;
export default route.Page;
