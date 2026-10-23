// src/utilities/contactRules.js
// ONE definition of "valid contact data" for the frontend.
// Backend twin: backend/utils/contactRules.js — keep the regexes identical so
// the UI never accepts something the server rejects (or vice-versa).
export { isValidUSPhone, normalizeUSPhone } from "./phone";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const ZIP_RE = /^\d{5}$/;

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
export const isValidEmail = (value) => EMAIL_RE.test(normalizeEmail(value));
export const isValidZip = (value) => ZIP_RE.test(String(value || ""));