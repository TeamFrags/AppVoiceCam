import nodemailer from 'nodemailer';

export type MailTemplate =
  'verify_email' | 'reset_password' | 'account_exists' | 'new_login' | 'password_changed';

export interface Mail {
  to: string;
  template: MailTemplate;
  data: Record<string, string>;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Plain-text rendering. Values in `data` come from the server, never from another user. */
export function renderMail(
  appName: string,
  mail: Pick<Mail, 'template' | 'data'>,
): { subject: string; text: string } {
  const d = mail.data;
  const sign = `\n\nL'équipe ${appName}`;
  switch (mail.template) {
    case 'verify_email':
      return {
        subject: `Confirme ton adresse e-mail — ${appName}`,
        text: `Bienvenue sur ${appName} !\n\nConfirme ton adresse en ouvrant ce lien (valable 24 heures) :\n${d.url}\n\nSi tu n'as pas créé de compte, ignore ce message.${sign}`,
      };
    case 'reset_password':
      return {
        subject: `Réinitialise ton mot de passe — ${appName}`,
        text: `Tu as demandé à changer ton mot de passe.\n\nOuvre ce lien (valable 1 heure) :\n${d.url}\n\nSi ce n'est pas toi, ignore ce message : ton mot de passe reste inchangé.${sign}`,
      };
    case 'account_exists':
      return {
        subject: `Tu as déjà un compte ${appName}`,
        text: `Quelqu'un a tenté de créer un compte avec cette adresse, qui en possède déjà un.\n\nSi c'est toi, connecte-toi ou réinitialise ton mot de passe. Sinon, tu n'as rien à faire.${sign}`,
      };
    case 'new_login':
      return {
        subject: `Nouvelle connexion à ton compte ${appName}`,
        text: `Une connexion vient d'avoir lieu depuis un emplacement inhabituel.\n\nAppareil : ${d.deviceName}\nAdresse IP : ${d.ip}\n\nSi ce n'est pas toi, change ton mot de passe : toutes tes sessions seront fermées.${sign}`,
      };
    case 'password_changed':
      return {
        subject: `Ton mot de passe ${appName} a été modifié`,
        text: `Ton mot de passe vient d'être modifié et tous tes appareils ont été déconnectés.\n\nSi ce n'est pas toi, réinitialise-le immédiatement.${sign}`,
      };
  }
}

export function createSmtpMailer(opts: { url: string; from: string; appName: string }): Mailer {
  const transport = nodemailer.createTransport(opts.url);
  return {
    async send(mail) {
      await transport.sendMail({ from: opts.from, to: mail.to, ...renderMail(opts.appName, mail) });
    },
  };
}

/** Development only: prints mails (including their links) to the terminal. */
export function createConsoleMailer(): Mailer {
  return {
    async send(mail) {
      console.log(`[mail:${mail.template}] to=${mail.to}`, mail.data);
    },
  };
}

export function createMemoryMailer(): Mailer & { outbox: Mail[] } {
  const outbox: Mail[] = [];
  return {
    outbox,
    async send(mail) {
      outbox.push(mail);
    },
  };
}
