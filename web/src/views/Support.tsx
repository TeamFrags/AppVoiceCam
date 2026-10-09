import Link from 'next/link';
import { localePath } from '@/i18n/config';
import { rich } from '@/i18n/format';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';
import { CONTACT_EMAIL } from '@/lib/site';
import { legalTags } from './legal';

export const support: View = {
  metadata(locale) {
    const t = getMessages(locale).support;
    return pageMetadata(locale, '/support/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).support;
    const tags = legalTags(locale);
    return (
      <section>
        <div className="container">
          <div className="section-head">
            <h1>{t.title}</h1>
            <p className="lead">{t.lead}</p>
            <p className="muted">
              {rich(t.faq, {
                a: (text) => <Link href={localePath(locale, '/faq/')}>{text}</Link>,
              })}
            </p>
            <a className="btn" href={`mailto:${CONTACT_EMAIL}`}>
              {t.emailButton}
            </a>
          </div>

          <h2>{t.topicsTitle}</h2>
          <div className="grid pairs">
            {t.topics.map((topic) => (
              <div className="card" key={topic.title} data-reveal>
                <h3>{topic.title}</h3>
                <p className="muted">{rich(topic.text, tags)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
};
