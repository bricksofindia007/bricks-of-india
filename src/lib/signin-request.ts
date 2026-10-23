// The request side of sign-in by email code. The only place that uses the platform's after-response hook.
// Use from a route handler or server action: the reply is returned at once, and the rest runs after it.
import { after } from 'next/server';
import { beginSignIn, type Reply, type SignInDeps, type SignInInput } from '@/lib/signin-email';

export function requestSignInCode(input: SignInInput, deps: SignInDeps): Reply {
  return beginSignIn(input, deps, (task) => {
    after(task);
  });
}
