import { localeRoute } from '@/i18n/route';
import { privacy } from '@/views/Privacy';

const route = localeRoute(privacy);
export const generateMetadata = route.generateMetadata;
export default route.Page;
