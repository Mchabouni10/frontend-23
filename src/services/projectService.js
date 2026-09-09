// src/services/projectService.js

import sendRequest from '../utilities/send-request';
import { saveLocalProject, getLocalProjects } from './offlineSyncService';

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

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export function saveProject(projectData) {
  console.log('📤 saveProject called with data:', {
    categoriesCount: projectData.categories?.length,
    categories: projectData.categories?.map((cat) => ({
      name: cat.name,
      key: cat.key,
      workItemsCount: cat.workItems?.length,
      workItems: cat.workItems?.map((item) => ({
        name: item.name,
        type: item.type,
        customWorkTypeName: item.customWorkTypeName,
      })),
    })),
  });

  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('❌ Validation errors in saveProject:', errors);
    return Promise.reject({ error: 'Validation failed', details: errors });
  }

  return sendRequest(BASE_URL, 'POST', projectData).catch((err) => {
    // If it's a network error or fetch failed, save offline
    if (err.message && (err.message.includes('fetch') || err.message.includes('Network'))) {
      console.warn('Network offline or fetch failed, saving project locally.');
      return saveLocalProject(projectData);
    }
    throw err;
  });
}

export function updateProject(id, projectData) {
  console.log('📤 updateProject called with data:', {
    id,
    categoriesCount: projectData.categories?.length,
    categories: projectData.categories?.map((cat) => ({
      name: cat.name,
      key: cat.key,
      workItemsCount: cat.workItems?.length,
      workItems: cat.workItems?.map((item) => ({
        name: item.name,
        type: item.type,
        customWorkTypeName: item.customWorkTypeName,
        hasCustomName: !!item.customWorkTypeName,
      })),
    })),
  });

  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('❌ Validation errors in updateProject:', errors);
    return Promise.reject({ error: 'Validation failed', details: errors });
  }

  return sendRequest(`${BASE_URL}${id}`, 'PUT', projectData).catch((err) => {
    if (err.message && (err.message.includes('fetch') || err.message.includes('Network'))) {
      console.warn(`Network offline or fetch failed, saving update for project ${id} locally.`);
      // Ensure we keep the original ID so when we sync it does a PUT
      return saveLocalProject({ ...projectData, _id: id });
    }
    throw err;
  });
}

let projectsRequest = null;

export async function getProjects() {
  // Multiple dashboard widgets mount together. Share one request instead of
  // making each widget hit the API and IndexedDB independently.
  if (projectsRequest) return projectsRequest;

  projectsRequest = (async () => {
  try {
    const onlineProjects = await sendRequest(BASE_URL, 'GET');
    const localProjects = await getLocalProjects();
    const pendingProjects = localProjects.filter(p => p._syncStatus === 'pending');
    
    // Combine online and offline projects
    // In a real scenario we'd merge duplicates, but for simplicity we append them
    return [...onlineProjects, ...pendingProjects];
  } catch (err) {
    // A 401 is expected when a session has expired; offline data is still a
    // valid fallback and logging the full stack on every widget is noisy.
    if (err.status !== 401) {
      console.warn('Failed to fetch projects from server. Loading offline projects.', err);
    }
    return await getLocalProjects();
  }
  })();

  try {
    return await projectsRequest;
  } finally {
    projectsRequest = null;
  }
}

export function getProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'GET').then((project) => {
    console.log('📥 getProject received:', {
      id,
      categoriesCount: project.categories?.length,
      categories: project.categories?.map((cat) => ({
        name: cat.name,
        key: cat.key,
        workItemsCount: cat.workItems?.length,
        workItems: cat.workItems?.map((item) => ({
          name: item.name,
          type: item.type,
          customWorkTypeName: item.customWorkTypeName,
          hasCustomName: !!item.customWorkTypeName,
        })),
      })),
    });

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
