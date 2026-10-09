import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { localePath } from '@/i18n/config';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';

export const download: View = {
  metadata(locale) {
    const t = getMessages(locale).download;
    return pageMetadata(locale, '/download/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).download;
    return (
      <section>
        <div className="container narrow">
          <h1>{t.title}</h1>
          <div className="card" data-reveal>
            <Icon name="download" />
            <div className="badge">Windows</div>
            <h2 style={{ marginTop: 8 }}>{t.soonTitle}</h2>
            <p className="muted">{t.text}</p>
            <div className="actions">
              <button type="button" className="btn" disabled>
                {t.button}
              </button>
              <Link href={localePath(locale, '/register/')} className="btn ghost">
                {t.cta}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  },
};
