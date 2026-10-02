// Plan limits — single source of truth for frontend and backend
export const PLAN_LIMITS = {
  basic: {
    ideasPerWeek: 95,
    ideasPerBatch: 5,
    filmingPerWeek: 50,
    renderMinutes: 25,
    storageMb: 5120, // 5 GB
  },
  top: {
    ideasPerWeek: 210,
    ideasPerBatch: 7,
    filmingPerWeek: 98,
    renderMinutes: 60,
    storageMb: 10240, // 10 GB
  },
}
