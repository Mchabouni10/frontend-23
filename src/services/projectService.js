//src/services/projectService.js
import sendRequest from '../utilities/send-request';

const BASE_URL = '/api/projects/';

// Validate project data before sending
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
      if (!item.surfaces || !Array.isArray(item.surfaces)) {
        errors.push(`Item at category ${catIndex}, item ${itemIndex} has no valid surfaces.`);
        return;
      }
      item.surfaces.forEach((surf, surfIndex) => {
        if (surf.measurementType === 'linear-foot') {
          const linearFt = parseFloat(surf.linearFt);
          if (isNaN(linearFt) || linearFt <= 0) {
            errors.push(`Invalid linear feet (${surf.linearFt}) at category ${catIndex}, item ${itemIndex}, surface ${surfIndex}.`);
          }
        } else if (surf.measurementType === 'by-unit') {
          const units = parseFloat(surf.units);
          if (isNaN(units) || units <= 0) {
            errors.push(`Invalid units (${surf.units}) at category ${catIndex}, item ${itemIndex}, surface ${surfIndex}.`);
          }
        } else if (surf.measurementType === 'single-surface' || surf.measurementType === 'room-surface') {
          const sqft = parseFloat(surf.sqft);
          if (isNaN(sqft) || sqft <= 0) {
            errors.push(`Invalid square footage (${surf.sqft}) at category ${catIndex}, item ${itemIndex}, surface ${surfIndex}.`);
          }
        }
      });
    });
  });

  return errors;
}

export function saveProject(projectData) {
  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('Validation errors in saveProject:', errors);
    // Proceed with data as-is, relying on sanitizeSurface
  }
  return sendRequest(BASE_URL, 'POST', projectData);
}

export function updateProject(id, projectData) {
  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('Validation errors in updateProject:', errors);
    // Proceed with data as-is
  }
  return sendRequest(`${BASE_URL}${id}`, 'PUT', projectData);
}

export function getProjects() {
  return sendRequest(BASE_URL, 'GET');
}

export function getProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'GET');
}

export function deleteProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'DELETE');
}