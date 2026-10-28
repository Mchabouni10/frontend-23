// src/services/projectService.js

import sendRequest from '../utilities/send-request';

const BASE_URL = '/api/projects/';

// Legacy measurement fields that belong ONLY inside surfaces[], not on work items.
// Matches LEGACY_MEASUREMENT_FIELDS in CategoriesContext.
const LEGACY_WORK_ITEM_FIELDS = ['units', 'linearFt', 'sqft', 'width', 'height'];

function stripLegacyFieldsFromProject(project) {
  if (!project || !Array.isArray(project.categories)) return project;

  return {
    ...project,
    categories: project.categories.map((cat) => ({
      ...cat,
      workItems: (cat.workItems || []).map((item) => {
        const cleaned = { ...item };
        LEGACY_WORK_ITEM_FIELDS.forEach((k) => delete cleaned[k]);
        return cleaned;
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Validate project data before sending to the server.
// ---------------------------------------------------------------------------
function validateProjectData(projectData) {
  const errors = [];

  // Drafts are allowed to be incomplete — the calculator is still being filled in.
  if (projectData?.workflowStatus === 'draft') {
    return errors;
  }

  if (!projectData.categories || !Array.isArray(projectData.categories)) {
    errors.push('Categories must be an array.');
    return errors;
  }

  projectData.categories.forEach((cat, catIndex) => {
    if (!cat.workItems || !Array.isArray(cat.workItems)) {
      errors.push(`Category at index ${catIndex} has no valid work items.`);
      return;
    }

    cat.workItems.forEach((item, itemIndex) => {
      // Validate custom work types have names
      if (
        item.type === 'custom-work-type' &&
        (!item.customWorkTypeName || item.customWorkTypeName.trim() === '')
      ) {
        errors.push(
          `Custom work item at category ${catIndex}, item ${itemIndex} is missing customWorkTypeName.`,
        );
      }

      if (!item.surfaces || !Array.isArray(item.surfaces)) {
        errors.push(
          `Item at category ${catIndex}, item ${itemIndex} has no valid surfaces.`,
        );
        return;
      }

      item.surfaces.forEach((surf, surfIndex) => {
        const type = (surf.measurementType || '').toLowerCase();

        if (type === 'linear-foot') {
          const linearFt = parseFloat(surf.linearFt);
          if (isNaN(linearFt) || linearFt <= 0) {
            errors.push(
              `Invalid linear feet (${surf.linearFt}) at category ${catIndex}, item ${itemIndex}, surface ${surfIndex}.`,
            );
          }
        } else if (type === 'by-unit') {
          const units = parseFloat(surf.units);
          if (isNaN(units) || units <= 0) {
            errors.push(
              `Invalid units (${surf.units}) at category ${catIndex}, item ${itemIndex}, surface ${surfIndex}.`,
            );
          }
        } else if (
          // FIX #1: Accept 'sqft' (canonical) alongside the legacy aliases
          type === 'sqft' ||
          type === 'single-surface' ||
          type === 'room-surface'
        ) {
          const sqft = parseFloat(surf.sqft);
          if (isNaN(sqft) || sqft <= 0) {
            errors.push(
              `Invalid square footage (${surf.sqft}) at category ${catIndex}, item ${itemIndex}, surface ${surfIndex}.`,
            );
          }
        }
        // Unknown types: skip validation (do not add an error — let the server decide)
      });
    });
  });

  return errors;
}

export const createClientRequestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `project_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

// ---------------------------------------------------------------------------
// Connection handling (no offline queue: we save online or we tell the user)
// ---------------------------------------------------------------------------

export const CONNECTION_MESSAGE =
  'Cannot reach the server. Please wait for the connection to come back, then try again.';

export function isConnectionError(err) {
  if (!err) return false;
  if (err.isConnectionError) return true;
  // Errors that carry an HTTP status from OUR server (400, 401, 404, 500...)
  // are real answers from the server, not connection problems.
  if (typeof err.status === 'number') return err.status === 408;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  // fetch() rejects with a TypeError ("Failed to fetch" / "Load failed" /
  // "NetworkError...") when the network is down. Match on the message so a
  // real programming TypeError is not mistaken for a connection problem.
  return (
    err.name === 'AbortError' ||
    /failed to fetch|load failed|network|timeout|timed out|abort/i.test(err.message || '')
  );
}

function toConnectionError(err, { mayHaveSaved = false } = {}) {
  const wrapped = new Error(
    mayHaveSaved
      ? `${CONNECTION_MESSAGE} Your last change may not have been saved yet. Pressing Save again is safe.`
      : CONNECTION_MESSAGE,
  );
  wrapped.isConnectionError = true;
  wrapped.cause = err;
  return wrapped;
}

function rejectIfOffline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(toConnectionError(null));
  }
  return null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

function validationRejection(errors) {
  const err = new Error(`Validation failed: ${errors.join(' ')}`);
  err.error = 'Validation failed';
  err.details = errors;
  return Promise.reject(err);
}

// Create a project.
// The server treats `clientRequestId` as an idempotency key: if the same key
// arrives twice (e.g. the first POST succeeded but the browser timed out),
// the server returns the project it already created instead of making a
// second one. The caller should therefore keep ONE key for the whole
// "create this project" attempt and reuse it when the user presses Save again.
export function saveProject(projectData) {
  const requestData = projectData.clientRequestId
    ? projectData
    : { ...projectData, clientRequestId: createClientRequestId() };

  const errors = validateProjectData(requestData);
  if (errors.length > 0) {
    console.error('Validation errors in saveProject:', errors);
    return validationRejection(errors);
  }

  const offline = rejectIfOffline();
  if (offline) return offline;

  return sendRequest(BASE_URL, 'POST', requestData).catch((err) => {
    if (isConnectionError(err)) throw toConnectionError(err, { mayHaveSaved: true });
    throw err;
  });
}

export function updateProject(id, projectData) {
  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('Validation errors in updateProject:', errors);
    return validationRejection(errors);
  }

  const offline = rejectIfOffline();
  if (offline) return offline;

  return sendRequest(`${BASE_URL}${id}`, 'PUT', projectData).catch((err) => {
    if (isConnectionError(err)) throw toConnectionError(err, { mayHaveSaved: true });
    throw err;
  });
}

let projectsRequest = null;

export async function getProjects() {
  // Several dashboard widgets mount together. Share one request instead of
  // letting each one hit the API.
  if (projectsRequest) return projectsRequest;

  projectsRequest = sendRequest(BASE_URL, 'GET').catch((err) => {
    if (isConnectionError(err)) throw toConnectionError(err);
    throw err;
  });

  try {
    return await projectsRequest;
  } finally {
    projectsRequest = null;
  }
}

export function getProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'GET')
    .catch((err) => {
      if (isConnectionError(err)) throw toConnectionError(err);
      throw err;
    })
    .then((project) => {
    // FIX #2: Strip legacy work item fields before handing data to the UI.
    // This is a transparent one-way migration: old projects are cleaned up
    // in memory on every load; they will be fully cleaned in the DB the next
    // time the user saves.
    return stripLegacyFieldsFromProject(project);
  });
}

export function deleteProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'DELETE');
}

export function duplicateProject(id) {
  return sendRequest(`${BASE_URL}${id}/duplicate`, 'POST');
}

export function getCalendarProjects() {
  return sendRequest(`${BASE_URL}calendar`, 'GET');
}

export function getProjectSummary() {
  return sendRequest(`${BASE_URL}summary`, 'GET');
}
