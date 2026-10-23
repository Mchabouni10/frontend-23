// src/utilities/address.js
//
// Single source of truth for splitting a free-text street address into
// {addressNumber, direction, streetName, streetType} and back. Previously
// this logic was copy-pasted into CustomerInfo.jsx and CustomerDirectory.jsx
// and had drifted slightly; now everything (including HomePage's contact
// sync) imports from here so a saved address always round-trips the same
// way no matter which screen wrote it.

export const DIRECTIONS = [
  { value: "", label: "Dir" },
  { value: "N", label: "N" },
  { value: "S", label: "S" },
  { value: "E", label: "E" },
  { value: "W", label: "W" },
  { value: "NE", label: "NE" },
  { value: "NW", label: "NW" },
  { value: "SE", label: "SE" },
  { value: "SW", label: "SW" },
];

export const STREET_TYPES = [
  { value: "", label: "Type" },
  { value: "St", label: "St" },
  { value: "Ave", label: "Ave" },
  { value: "Blvd", label: "Blvd" },
  { value: "Dr", label: "Dr" },
  { value: "Rd", label: "Rd" },
  { value: "Ln", label: "Ln" },
  { value: "Ct", label: "Ct" },
  { value: "Cir", label: "Cir" },
  { value: "Pl", label: "Pl" },
  { value: "Way", label: "Way" },
  { value: "Pkwy", label: "Pkwy" },
  { value: "Ter", label: "Ter" },
  { value: "Trail", label: "Trail" },
];

const DIRECTION_VALUES = DIRECTIONS.map((d) => d.value).filter(Boolean);
const STREET_TYPE_VALUES = STREET_TYPES.map((t) => t.value).filter(Boolean);

const EMPTY_ADDRESS = {
  addressNumber: "",
  direction: "",
  streetName: "",
  streetType: "",
};

// Utility function to parse street address into components
export function parseStreetAddress(street) {
  if (!street) return { ...EMPTY_ADDRESS };

  const parts = street.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return { ...EMPTY_ADDRESS };

  let addressNumber = "";
  let direction = "";
  let streetName = "";
  let streetType = "";

  // First part is always the address number
  if (/^\d+$/.test(parts[0])) {
    addressNumber = parts[0];
  }

  // Look for direction (N, S, E, W, NE, NW, SE, SW)
  let startIndex = addressNumber ? 1 : 0;
  if (
    parts.length > startIndex &&
    DIRECTION_VALUES.includes(parts[startIndex].toUpperCase())
  ) {
    direction = parts[startIndex];
    startIndex++;
  }

  // Last part might be street type
  let endIndex = parts.length;
  if (
    parts.length > startIndex &&
    STREET_TYPE_VALUES.includes(parts[parts.length - 1])
  ) {
    streetType = parts[parts.length - 1];
    endIndex = parts.length - 1;
  }

  // Everything in between is the street name
  if (startIndex < endIndex) {
    streetName = parts.slice(startIndex, endIndex).join(" ");
  }

  return { addressNumber, direction, streetName, streetType };
}

// Utility function to construct street address from components
export function constructStreetAddress({
  addressNumber,
  direction,
  streetName,
  streetType,
} = {}) {
  return [addressNumber, direction, streetName, streetType]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(" ");
}