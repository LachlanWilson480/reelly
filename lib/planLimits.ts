// Plan limits - single source of truth for frontend and backend
// Clip library caps. The database enforces the same numbers (see supabase/migrations/add_library_limits.sql), so change both together.
export const LIBRARY_LIMITS = {
  free: { storageMb: 500, maxClips: 25 },
  basic: { storageMb: 5120, maxClips: 150 },
  top: { storageMb: 10240, maxClips: 400 },
  maxFileMb: 500,
}

export const PLAN_LIMITS = {
  basic: {
    ideasPerWeek: 95,
    ideasPerBatch: 5,
    filmingPerWeek: 50,
    scriptsPerWeek: 20,
    renderMinutes: 25,
    storageMb: 5120,
  },
  top: {
    ideasPerWeek: 210,
    ideasPerBatch: 7,
    filmingPerWeek: 98,
    scriptsPerWeek: 96,
    renderMinutes: 60,
    storageMb: 10240,
  },
}
