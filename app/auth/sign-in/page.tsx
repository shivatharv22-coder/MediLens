import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/app';

/**
 * Signing in happens on the Profile screen. This route exists so that older
 * links, bookmarks and the conventional `/auth/sign-in` path still land in the
 * right place.
 */
export default function SignInRedirect() {
  redirect(ROUTES.signIn);
}
