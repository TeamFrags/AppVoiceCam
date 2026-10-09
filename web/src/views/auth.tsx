import { Account } from '@/components/Account';
import { Admin } from '@/components/Admin';
import {
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
  ResetPasswordForm,
  VerifyEmail,
} from '@/components/AuthForms';
import { getMessages } from '@/i18n/index';
import { pageMetadata, type View } from '@/i18n/route';

// These pages are forms that run in the browser: here they only get a title and an address.

export const login: View = {
  metadata: (l) => pageMetadata(l, '/login/', { title: getMessages(l).auth.signInTitle }),
  Page: () => <LoginForm />,
};

export const register: View = {
  metadata: (l) => pageMetadata(l, '/register/', { title: getMessages(l).auth.registerTitle }),
  Page: () => <RegisterForm />,
};

export const forgotPassword: View = {
  metadata: (l) => pageMetadata(l, '/forgot-password/', { title: getMessages(l).auth.forgotTitle }),
  Page: () => <ForgotPasswordForm />,
};

// Private or single-use pages: nothing to index.

export const resetPassword: View = {
  metadata: (l) =>
    pageMetadata(l, '/reset-password/', {
      title: getMessages(l).auth.resetTitle,
      noindex: true,
    }),
  Page: () => <ResetPasswordForm />,
};

export const verifyEmail: View = {
  metadata: (l) =>
    pageMetadata(l, '/verify-email/', {
      title: getMessages(l).auth.verifyTitle,
      noindex: true,
    }),
  Page: () => <VerifyEmail />,
};

export const account: View = {
  metadata: (l) =>
    pageMetadata(l, '/account/', { title: getMessages(l).account.title, noindex: true }),
  Page: () => <Account />,
};

export const admin: View = {
  metadata: (l) =>
    pageMetadata(l, '/admin/', { title: getMessages(l).admin.title, noindex: true }),
  Page: () => <Admin />,
};
