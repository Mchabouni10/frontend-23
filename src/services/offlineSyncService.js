import localforage from 'localforage';
import sendRequest from '../utilities/send-request';
import { getUser } from '../utilities/users-service';

// Initialize stores
const projectsStore = localforage.createInstance({
  name: 'RawdahApp',
  storeName: 'projects'
});

let syncInFlight = null;
const announceSync = (detail) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('project-sync-status', { detail }));
  }
};

/**
 * Saves a project locally and marks it as pending sync
 */
export async function saveLocalProject(projectData) {
  try {
    const id = projectData._id || `offline_${Date.now()}`;
    const projectToSave = {
      ...projectData,
      _id: id,
      _syncStatus: 'pending', // Flag for later syncing
      _localUpdatedAt: new Date().toISOString(),
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
    announceSync({ status: 'offline', message: 'Waiting for an internet connection before syncing projects.' });
    return;
  }

  if (!getUser()) {
    return;
  }

  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
  console.log('Starting offline sync process...');
  announceSync({ status: 'syncing', message: 'Connection restored. Saving pending projects…' });
  const localProjects = await getLocalProjects();
  const pendingProjects = localProjects.filter(p => p._syncStatus === 'pending');

  if (pendingProjects.length === 0) {
    console.log('No pending projects to sync.');
    announceSync({ status: 'idle', message: '' });
    return;
  }

  for (const project of pendingProjects) {
    try {
      // Remove local-only fields before sending to server
      const { _id, _syncStatus, _localUpdatedAt, _syncConflict, ...dataToSync } = project;
      
      // If it has an offline ID, it's a completely new project
      if (_id.startsWith('offline_')) {
        await sendRequest('/api/projects/', 'POST', dataToSync);
      } else {
        // Never silently overwrite a newer server version. Keep the local
        // copy for explicit user resolution instead.
        const remote = await sendRequest(`/api/projects/${_id}`, 'GET');
        const localTime = Date.parse(_localUpdatedAt || project.updatedAt || 0);
        const remoteTime = Date.parse(remote?.updatedAt || 0);
        if (remoteTime && localTime && remoteTime > localTime) {
          await projectsStore.setItem(_id, {
            ...project,
            _syncStatus: 'conflict',
            _syncConflict: { detectedAt: new Date().toISOString(), remoteUpdatedAt: remote.updatedAt },
          });
          console.warn(`Sync conflict detected for project ${_id}; local copy was preserved.`);
          continue;
        }
        await sendRequest(`/api/projects/${_id}`, 'PUT', dataToSync);
      }
      
      // Remove from local storage once synced
      await removeLocalProject(_id);
      console.log(`Successfully synced project ${_id}.`);
      announceSync({ status: 'synced', message: 'Pending project saved successfully.' });
    } catch (error) {
      console.error(`Failed to sync project ${project._id}:`, error);
      announceSync({ status: 'waiting', message: 'Project is safe on this device. Waiting for the database connection to return.' });
    }
  }
  })();
  try { return await syncInFlight; } finally { syncInFlight = null; }
}
