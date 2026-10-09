'use client';

import Link from 'next/link';
import { useId } from 'react';
import { useI18n } from '@/i18n/client';
import { localePath } from '@/i18n/config';
import { rich } from '@/i18n/format';
import { publicApi } from '@/lib/api';
import { Field, Notice, useSubmit } from './AuthForms';

// The values the server accepts, with the name shown for each. "other" is translated.
const PLATFORMS = { twitch: 'Twitch', youtube: 'YouTube', tiktok: 'TikTok', kick: 'Kick' };

/** Application to the creator program. */
export function CreatorForm() {
  const { locale, t } = useI18n();
  const platformId = useId();
  const messageId = useId();
  const { status, onSubmit, busy, done } = useSubmit(async (data) => {
    await publicApi('/v1/creators/apply', {
      name: String(data.get('name')),
      email: String(data.get('email')),
      platform: String(data.get('platform')),
      channelUrl: String(data.get('channelUrl')),
      message: String(data.get('message')),
      website: String(data.get('website')),
      locale,
    });
    return t.creatorForm.done;
  });

  if (done) {
    return (
      <>
        <svg className="done-mark" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" pathLength="1" />
          <path d="M15 27l8 8 14-16" pathLength="1" />
        </svg>
        <Notice status={status} />
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <Notice status={status} />
      <Field label={t.creatorForm.name} name="name" type="text" autoComplete="nickname" />
      <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
      <div className="field">
        <div className="field-box">
          <select id={platformId} name="platform" defaultValue="twitch" required>
            {Object.entries(PLATFORMS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="other">{t.creatorForm.other}</option>
          </select>
          <label htmlFor={platformId}>{t.creatorForm.platform}</label>
        </div>
      </div>
      <Field label={t.creatorForm.channelUrl} name="channelUrl" type="url" autoComplete="url" />
      <div className="field">
        <div className="field-box">
          <textarea id={messageId} name="message" rows={4} maxLength={1000} placeholder=" " />
          <label htmlFor={messageId}>{t.creatorForm.message}</label>
        </div>
      </div>
      {/* Invisible to people: a robot that fills it in gives itself away. */}
      <input className="trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn" disabled={busy} data-busy={busy || undefined}>
        {t.creatorForm.submit}
      </button>
      <p className="muted form-note">
        {rich(t.creatorForm.notice, {
          a: (text) => <Link href={localePath(locale, '/privacy/')}>{text}</Link>,
        })}
      </p>
    </form>
  );
}
