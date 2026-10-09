import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { localePath } from '@/i18n/config';
import { rich } from '@/i18n/format';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';

// Same order as `features.groups` in the messages.
const GROUP_ICONS: IconName[] = ['face', 'voice', 'devices', 'gauge', 'shield'];

export const features: View = {
  metadata(locale) {
    const t = getMessages(locale).features;
    return pageMetadata(locale, '/features/', { title: t.title, description: t.description });
  },
  Page({ locale }) {
    const t = getMessages(locale).features;
    return (
      <section>
        <div className="container">
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
          <div className="grid">
            {t.groups.map((group, i) => (
              <article key={group.title} className="card" data-reveal>
                <Icon name={GROUP_ICONS[i] ?? 'spark'} />
                <h2>{group.title}</h2>
                <ul className="checks">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 24 }}>
            {rich(t.note, {
              a: (text) => <Link href={localePath(locale, '/register/')}>{text}</Link>,
            })}
          </p>
        </div>
      </section>
    );
  },
};
