const STORAGE_KEY = 'rawdah_project_draft_v1';

export function saveDraftLocally(draft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  } catch (err) {
    console.warn('Unable to save local project draft:', err);
  }
}

export function getDraftLocally() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Unable to read local project draft:', err);
    return null;
  }
}

export function clearDraftLocally() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Unable to clear local project draft:', err);
  }
}
