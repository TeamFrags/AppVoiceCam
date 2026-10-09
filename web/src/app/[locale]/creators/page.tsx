import { localeRoute } from '@/i18n/route';
import { creators } from '@/views/Creators';

const route = localeRoute(creators);
export const generateMetadata = route.generateMetadata;
export default route.Page;
