// src/utilities/contactPayload.js
//
// Single source of truth for what is pushed to / read from the Contacts
// directory (the `Customer` model) from anywhere that isn't the directory's
// own form.
//
// Project-only fields (projectName, type, paymentType, startDate, finishDate,
// status, project notes) never travel to a contact. Contact notes never travel
// into a project.
import { parseStreetAddress } from "./address";
import { formatUSPhone, isValidUSPhone, normalizeUSPhone } from "./phone";
import { isValidEmail, isValidZip, normalizeEmail } from "./contactRules";

const ADDRESS_PARTS = ["addressNumber", "direction", "streetName", "streetType"];

// The person/address fields shared by contacts and project snapshots.
function pickContactFields(source = {}) {
  const address = parseStreetAddress(source.street);
  return {
    firstName: source.firstName || "",
    lastName: source.lastName || "",
    street: source.street || "",
    unit: source.unit || "",
    city: source.city || "",
    state: source.state || "",
    zipCode: source.zipCode || "",
    phone: normalizeUSPhone(source.phone || ""),
    email: source.email || "",
    addressNumber: address.addressNumber,
    direction: address.direction,
    streetName: address.streetName,
    streetType: address.streetType,
  };
}

// Payload to CREATE a contact from a project's customer form.
export function buildContactPayload(customer = {}) {
  return pickContactFields(customer);
}

// Fields a project receives when a contact is imported into it.
export function buildProjectCustomerFields(contact = {}) {
  return pickContactFields(contact);
}

// Is there enough contact info to safely create/update a Contacts record?
// Uses the same shared rules as the server, so anything that passes here also
// passes the backend's validation.
export function isContactPayloadComplete(customer = {}) {
  const address = parseStreetAddress(customer.street);
  return Boolean(
    customer.firstName?.trim() &&
      customer.lastName?.trim() &&
      address.addressNumber?.trim() &&
      address.streetName?.trim() &&
      customer.city?.trim() &&
      customer.state?.trim() &&
      isValidZip(customer.zipCode) &&
      customer.phone &&
      isValidUSPhone(customer.phone) &&
      customer.email &&
      isValidEmail(customer.email),
  );
}

// ── Safe "Update Contact" support ───────────────────────────────────────────
// Compares what the user sees in the project form with the contact's CURRENT
// saved data and returns only what actually differs. This is what prevents an
// old project from silently overwriting newer contact details.
const COMPARE_FIELDS = ["firstName", "lastName", "street", "unit", "city", "state", "zipCode", "phone", "email"];
const LABELS = {
  firstName: "First name", lastName: "Last name", street: "Street", unit: "Unit",
  city: "City", state: "State", zipCode: "ZIP", phone: "Phone", email: "Email",
};

const comparable = (field, value) => {
  const text = String(value ?? "").trim();
  if (field === "phone") return normalizeUSPhone(text);
  if (field === "email") return normalizeEmail(text);
  return text;
};

export function diffContactFields(current = {}, next = {}) {
  const changes = {};
  const patch = {};
  COMPARE_FIELDS.forEach((field) => {
    const from = comparable(field, current[field]);
    const to = comparable(field, next[field]);
    if (from !== to) {
      changes[field] = { from, to };
      patch[field] = to;
    }
  });
  // street changed → send the matching parsed parts too so they never go stale
  if (changes.street) ADDRESS_PARTS.forEach((k) => { patch[k] = next[k] ?? ""; });
  return { changes, patch };
}

export function describeContactChanges(changes = {}) {
  const show = (field, value) => (field === "phone" ? formatUSPhone(value) : value) || "(empty)";
  return Object.entries(changes)
    .map(([field, { from, to }]) => `• ${LABELS[field]}: ${show(field, from)}  →  ${show(field, to)}`)
    .join("\n");
}
