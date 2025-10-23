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
      // CRITICAL: Validate custom work types have customWorkTypeName
      if (item.type === 'custom-work-type' && (!item.customWorkTypeName || item.customWorkTypeName.trim() === '')) {
        errors.push(`Custom work item at category ${catIndex}, item ${itemIndex} is missing customWorkTypeName.`);
      }

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
  // DEBUG: Log what we're about to send
  console.log('📤 saveProject called with data:', {
    categoriesCount: projectData.categories?.length,
    categories: projectData.categories?.map((cat, i) => ({
      name: cat.name,
      key: cat.key,
      workItemsCount: cat.workItems?.length,
      workItems: cat.workItems?.map(item => ({
        name: item.name,
        type: item.type,
        customWorkTypeName: item.customWorkTypeName,
      }))
    }))
  });

  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('❌ Validation errors in saveProject:', errors);
    // Return the errors instead of proceeding
    return Promise.reject({ error: 'Validation failed', details: errors });
  }
  
  return sendRequest(BASE_URL, 'POST', projectData);
}

export function updateProject(id, projectData) {
  // DEBUG: Log what we're about to send
  console.log('📤 updateProject called with data:', {
    id,
    categoriesCount: projectData.categories?.length,
    categories: projectData.categories?.map((cat, i) => ({
      name: cat.name,
      key: cat.key,
      workItemsCount: cat.workItems?.length,
      workItems: cat.workItems?.map(item => ({
        name: item.name,
        type: item.type,
        customWorkTypeName: item.customWorkTypeName,
        hasCustomName: !!item.customWorkTypeName,
      }))
    }))
  });

  const errors = validateProjectData(projectData);
  if (errors.length > 0) {
    console.error('❌ Validation errors in updateProject:', errors);
    return Promise.reject({ error: 'Validation failed', details: errors });
  }
  
  return sendRequest(`${BASE_URL}${id}`, 'PUT', projectData);
}

export function getProjects() {
  return sendRequest(BASE_URL, 'GET');
}

export function getProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'GET').then(project => {
    // DEBUG: Log what we received
    console.log('📥 getProject received:', {
      id,
      categoriesCount: project.categories?.length,
      categories: project.categories?.map((cat, i) => ({
        name: cat.name,
        key: cat.key,
        workItemsCount: cat.workItems?.length,
        workItems: cat.workItems?.map(item => ({
          name: item.name,
          type: item.type,
          customWorkTypeName: item.customWorkTypeName,
          hasCustomName: !!item.customWorkTypeName,
        }))
      }))
    });
    return project;
  });
}

export function deleteProject(id) {
  return sendRequest(`${BASE_URL}${id}`, 'DELETE');
}