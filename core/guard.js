// Actor lookup for write functions. Each system calls actorFor() first and then applies its own
// permission rules in its own code (prompt 3.3). Hiding a button is never enough.
import { bus } from './bus.js';
import { assertOnline, deny, ALUMNI_RO } from './errors.js';

/** Returns Users' actor flags for uid, or throws. readOnly alumni are refused unless allowReadOnly. */
export function actorFor(uid, { allowReadOnly = false, allowNoRole = false } = {}) {
  assertOnline();
  const a = uid && bus.has('users.actor') ? bus.read('users.actor', uid) : null;
  if (!a || (a.status !== 'active' && a.status !== 'alumni')) deny();
  if (a.readOnly && !allowReadOnly) deny(ALUMNI_RO);
  if (a.noRole && !allowNoRole) deny();
  return a;
}
/** For automatic actions done by a system (no person). */
export const SYSTEM_ACTOR = 'system';
