/**
 * Personal app for one learner — edit the name here (no login).
 * Or set env when building: VITE_LEARNER_NAME=Leyla
 */
export const LEARNER_NAME =
  (import.meta.env.VITE_LEARNER_NAME as string | undefined)?.trim() || 'Leyla';
