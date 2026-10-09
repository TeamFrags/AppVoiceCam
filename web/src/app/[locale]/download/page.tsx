import { localeRoute } from '@/i18n/route';
import { download } from '@/views/Download';

const route = localeRoute(download);
export const generateMetadata = route.generateMetadata;
export default route.Page;
