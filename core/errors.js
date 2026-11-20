// Shared error helpers. Every system's write function checks the actor first and throws
// AppError with a Hebrew message; the UI shows it in a toast.
import { isOnline } from './net.js';

export class AppError extends Error {}
export const NO_PERMISSION = 'אין לך הרשאה לפעולה הזו';
export const OFFLINE = 'דרוש חיבור לאינטרנט';
export const ALUMNI_RO = 'בוגרים במצב קריאה בלבד';

export function deny(msg = NO_PERMISSION) { throw new AppError(msg); }
export function check(cond, msg = NO_PERMISSION) { if (!cond) deny(msg); }
export function assertOnline() { if (!isOnline()) throw new AppError(OFFLINE); }
