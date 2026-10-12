import { recordDailyCheckIn } from './utils/checkIn';

const STARS_KEY = 'pinyin_progress_stars';

/** Simple progress counter for this browser (one learner). */
export function getStars(): number {
  try {
    const v = localStorage.getItem(STARS_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function addStars(n: number) {
  if (n > 0) recordDailyCheckIn();
  const next = getStars() + n;
  try {
    localStorage.setItem(STARS_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}
