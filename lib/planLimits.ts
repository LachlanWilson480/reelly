// Plan limits — single source of truth for frontend and backend
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
