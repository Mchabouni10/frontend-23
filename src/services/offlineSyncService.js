import localforage from 'localforage';
import sendRequest from '../utilities/send-request';

// Initialize stores
const projectsStore = localforage.createInstance({
  name: 'RawdahApp',
  storeName: 'projects'
});

/**
 * Saves a project locally and marks it as pending sync
 */
export async function saveLocalProject(projectData) {
  try {
    const id = projectData._id || `offline_${Date.now()}`;
    const projectToSave = {
      ...projectData,
      _id: id,
      _syncStatus: 'pending' // Flag for later syncing
    };
    
    await projectsStore.setItem(id, projectToSave);
    console.log(`Saved project ${id} locally (offline).`);
    return projectToSave;
  } catch (error) {
    console.error('Failed to save project locally:', error);
    throw error;
  }
}

/**
 * Retrieves all locally saved projects
 */
export async function getLocalProjects() {
  try {
    const projects = [];
    await projectsStore.iterate((value) => {
      projects.push(value);
    });
    return projects;
  } catch (error) {
    console.error('Failed to get local projects:', error);
    return [];
  }
}

/**
 * Removes a locally saved project (e.g. after successful sync)
 */
export async function removeLocalProject(id) {
  try {
    await projectsStore.removeItem(id);
    console.log(`Removed local project ${id}.`);
  } catch (error) {
    console.error(`Failed to remove local project ${id}:`, error);
  }
}

/**
 * Attempts to push all 'pending' projects to the backend
 */
export async function syncOfflineProjects() {
  if (!navigator.onLine) {
    console.log('Cannot sync: device is still offline.');
    return;
  }

  console.log('Starting offline sync process...');
  const localProjects = await getLocalProjects();
  const pendingProjects = localProjects.filter(p => p._syncStatus === 'pending');

  if (pendingProjects.length === 0) {
    console.log('No pending projects to sync.');
    return;
  }

  for (const project of pendingProjects) {
    try {
      // Remove local-only fields before sending to server
      const { _id, _syncStatus, ...dataToSync } = project;
      
      // If it has an offline ID, it's a completely new project
      if (_id.startsWith('offline_')) {
        await sendRequest('/api/projects/', 'POST', dataToSync);
      } else {
        await sendRequest(`/api/projects/${_id}`, 'PUT', dataToSync);
      }
      
      // Remove from local storage once synced
      await removeLocalProject(_id);
      console.log(`Successfully synced project ${_id}.`);
    } catch (error) {
      console.error(`Failed to sync project ${project._id}:`, error);
    }
  }
}
