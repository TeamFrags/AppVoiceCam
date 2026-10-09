import { defaultRoute } from '@/i18n/route';
import { download } from '@/views/Download';

const route = defaultRoute(download);
export const metadata = route.metadata;
export default route.Page;
