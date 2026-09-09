// src/hooks/useWorkTypeTaxonomy.js
/**
 * useWorkTypeTaxonomy
 *
 * Fetches the full work-type hierarchy from the backend and exposes
 * helpers for creating custom categories, work types, and subtypes.
 *
 * Usage:
 *   const {
 *     categories,          // full tree
 *     loading,
 *     error,
 *     getCategoryWorkTypes,  // (categoryKey) => WorkType[]
 *     getSubtypes,           // (workTypeKey)  => Subtype[]
 *     getDefaultSubtype,     // (workTypeKey)  => string | null
 *     createCategory,        // ({ name, key? })                      → Promise<Category>
 *     createWorkType,        // ({ categoryKey, name, measurementType? }) → Promise<WorkType>
 *     createSubtype,         // ({ workTypeKey, value, isDefault? })  → Promise<Subtype>
 *     setDefaultSubtype,     // ({ workTypeKey, subtypeId })          → Promise<Subtype>
 *     deleteCategory,        // (categoryKey)                         → Promise<void>
 *     deleteWorkType,        // (workTypeKey)                         → Promise<void>
 *     deleteSubtype,         // ({ workTypeKey, subtypeId })          → Promise<void>
 *   } = useWorkTypeTaxonomy();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthHeaders } from '../utilities/send-request';

const BASE = '/api/work-types';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { ...authHeaders(), ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json.data;
}

export function useWorkTypeTaxonomy() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch(BASE);
      setCategories(data);
    } catch (err) {
      console.error('❌ useWorkTypeTaxonomy fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Read helpers (derived from local state — no extra network call)
  // ---------------------------------------------------------------------------
  const getCategoryWorkTypes = useCallback(
    (categoryKey) => {
      const cat = categories.find((c) => c.key === categoryKey);
      return cat?.workTypes ?? [];
    },
    [categories]
  );

  const getSubtypes = useCallback(
    (workTypeKey) => {
      for (const cat of categories) {
        const wt = cat.workTypes?.find((w) => w.key === workTypeKey);
        if (wt) return wt.subtypes ?? [];
      }
      return [];
    },
    [categories]
  );

  const getDefaultSubtype = useCallback(
    (workTypeKey) => {
      const subtypes = getSubtypes(workTypeKey);
      const def = subtypes.find((s) => s.isDefault);
      return def?.value ?? subtypes[0]?.value ?? null;
    },
    [getSubtypes]
  );

  // ---------------------------------------------------------------------------
  // Mutations — update local state optimistically then confirm via server
  // ---------------------------------------------------------------------------

  /** Create a new custom category */
  const createCategory = useCallback(async ({ name, key }) => {
    const newCat = await apiFetch(`${BASE}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name, key }),
    });
    setCategories((prev) => [...prev, { ...newCat, workTypes: [] }]);
    return newCat;
  }, []);

  /** Delete a custom category */
  const deleteCategory = useCallback(async (categoryKey) => {
    await apiFetch(`${BASE}/categories/${categoryKey}`, { method: 'DELETE' });
    setCategories((prev) => prev.filter((c) => c.key !== categoryKey));
  }, []);

  /** Create a custom work type inside any category */
  const createWorkType = useCallback(async ({ categoryKey, name, measurementType }) => {
    const newWT = await apiFetch(`${BASE}/categories/${categoryKey}/work-types`, {
      method: 'POST',
      body: JSON.stringify({ name, measurementType }),
    });
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.key !== categoryKey) return cat;
        return {
          ...cat,
          workTypes: [...(cat.workTypes || []), { ...newWT, subtypes: [] }],
        };
      })
    );
    return newWT;
  }, []);

  /** Delete a custom work type */
  const deleteWorkType = useCallback(async (workTypeKey) => {
    await apiFetch(`${BASE}/work-types/${workTypeKey}`, { method: 'DELETE' });
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes || []).filter((wt) => wt.key !== workTypeKey),
      }))
    );
  }, []);

  /** Add a custom subtype to any work type */
  const createSubtype = useCallback(async ({ workTypeKey, value, isDefault }) => {
    const newST = await apiFetch(`${BASE}/work-types/${workTypeKey}/subtypes`, {
      method: 'POST',
      body: JSON.stringify({ value, isDefault }),
    });
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes || []).map((wt) => {
          if (wt.key !== workTypeKey) return wt;
          // If new subtype is default, clear existing defaults
          const updatedSubtypes = isDefault
            ? (wt.subtypes || []).map((s) => ({ ...s, isDefault: false }))
            : [...(wt.subtypes || [])];
          return { ...wt, subtypes: [...updatedSubtypes, newST] };
        }),
      }))
    );
    return newST;
  }, []);

  /** Delete a custom subtype */
  const deleteSubtype = useCallback(async ({ workTypeKey, subtypeId }) => {
    await apiFetch(`${BASE}/work-types/${workTypeKey}/subtypes/${subtypeId}`, {
      method: 'DELETE',
    });
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes || []).map((wt) => {
          if (wt.key !== workTypeKey) return wt;
          return {
            ...wt,
            subtypes: (wt.subtypes || []).filter((s) => s._id !== subtypeId),
          };
        }),
      }))
    );
  }, []);

  /** Set a subtype as the default for its work type */
  const setDefaultSubtype = useCallback(async ({ workTypeKey, subtypeId }) => {
    const updated = await apiFetch(
      `${BASE}/work-types/${workTypeKey}/subtypes/${subtypeId}/set-default`,
      { method: 'PATCH' }
    );
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes || []).map((wt) => {
          if (wt.key !== workTypeKey) return wt;
          return {
            ...wt,
            subtypes: (wt.subtypes || []).map((s) => ({
              ...s,
              isDefault: s._id === subtypeId,
            })),
          };
        }),
      }))
    );
    return updated;
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchAll,
    // Read helpers
    getCategoryWorkTypes,
    getSubtypes,
    getDefaultSubtype,
    // Mutations
    createCategory,
    deleteCategory,
    createWorkType,
    deleteWorkType,
    createSubtype,
    deleteSubtype,
    setDefaultSubtype,
  };
}
