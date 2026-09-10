// src/context/WorkTypeTaxonomyContext.jsx
/**
 * WorkTypeTaxonomyContext
 *
 * Single shared source of truth for the full work-type hierarchy.
 * Wrap your app (or calculator section) in <WorkTypeTaxonomyProvider>.
 * Every component that calls useWorkTypeTaxonomy() shares the SAME state,
 * the SAME fetch, and mutations are immediately visible everywhere.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import PropTypes from "prop-types";
import sendRequest from "../utilities/send-request";

const BASE = "/api/work-types";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch(path, method = "GET", payload = null) {
  const json = await sendRequest(path, method, payload);
  if (json && json.success === false) {
    throw new Error(json.error || "Request failed");
  }
  return json?.data !== undefined ? json.data : json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const WorkTypeTaxonomyContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function WorkTypeTaxonomyProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Strict-mode / double-mount guard
  const hasFetched = useRef(false);

  // ── Initial load ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch(BASE);
      setCategories(data);
    } catch (err) {
      console.error("❌ WorkTypeTaxonomy fetch error:", err);
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

  // ── Read helpers ─────────────────────────────────────────────────────────────

  const getCategoryWorkTypes = useCallback(
    (categoryKey) => {
      const cat = categories.find((c) => c.key === categoryKey);
      return cat?.workTypes ?? [];
    },
    [categories],
  );

  const getSubtypes = useCallback(
    (workTypeKey) => {
      for (const cat of categories) {
        const wt = cat.workTypes?.find((w) => w.key === workTypeKey);
        if (wt) return wt.subtypes ?? [];
      }
      return [];
    },
    [categories],
  );

  const getDefaultSubtype = useCallback(
    (workTypeKey) => {
      const subtypes = getSubtypes(workTypeKey);
      const def = subtypes.find((s) => s.isDefault);
      return def?.value ?? subtypes[0]?.value ?? null;
    },
    [getSubtypes],
  );

  // ── Mutations ────────────────────────────────────────────────────────────────

  /** Create a new custom category */
  const createCategory = useCallback(async ({ name, key }) => {
    const newCat = await apiFetch(`${BASE}/categories`, "POST", { name, key });
    setCategories((prev) => [...prev, { ...newCat, workTypes: [] }]);
    return newCat;
  }, []);

  /** Rename a category */
  const updateCategory = useCallback(async (categoryKey, { name }) => {
    const updated = await apiFetch(`${BASE}/categories/${categoryKey}`, "PATCH", { name });
    setCategories((prev) =>
      prev.map((cat) =>
        cat.key === categoryKey ? { ...cat, name: updated.name } : cat,
      ),
    );
    return updated;
  }, []);

  /** Delete a custom category (cascades work types + subtypes) */
  const deleteCategory = useCallback(async (categoryKey) => {
    await apiFetch(`${BASE}/categories/${categoryKey}`, "DELETE");
    setCategories((prev) => prev.filter((c) => c.key !== categoryKey));
  }, []);

  /** Create a custom work type inside any category */
  const createWorkType = useCallback(
    async ({ categoryKey, name, measurementType }) => {
      const newWT = await apiFetch(
        `${BASE}/categories/${categoryKey}/work-types`,
        "POST",
        { name, measurementType },
      );
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.key !== categoryKey) return cat;
          return {
            ...cat,
            workTypes: [...(cat.workTypes ?? []), { ...newWT, subtypes: [] }],
          };
        }),
      );
      return newWT;
    },
    [],
  );

  /** Edit a work type's name and/or measurementType */
  const updateWorkType = useCallback(
    async (workTypeKey, { name, measurementType }) => {
      const updated = await apiFetch(`${BASE}/work-types/${workTypeKey}`, "PATCH", {
        name,
        measurementType,
      });
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          workTypes: (cat.workTypes ?? []).map((wt) =>
            wt.key === workTypeKey
              ? {
                  ...wt,
                  name: updated.name,
                  measurementType: updated.measurementType,
                }
              : wt,
          ),
        })),
      );
      return updated;
    },
    [],
  );

  /** Delete a custom work type (cascades subtypes) */
  const deleteWorkType = useCallback(async (workTypeKey) => {
    await apiFetch(`${BASE}/work-types/${workTypeKey}`, "DELETE");
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes ?? []).filter((wt) => wt.key !== workTypeKey),
      })),
    );
  }, []);

  /** Add a custom subtype to any work type */
  const createSubtype = useCallback(
    async ({ workTypeKey, value, isDefault }) => {
      const newST = await apiFetch(
        `${BASE}/work-types/${workTypeKey}/subtypes`,
        "POST",
        { value, isDefault },
      );
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          workTypes: (cat.workTypes ?? []).map((wt) => {
            if (wt.key !== workTypeKey) return wt;
            const updatedSubtypes = isDefault
              ? (wt.subtypes ?? []).map((s) => ({ ...s, isDefault: false }))
              : [...(wt.subtypes ?? [])];
            return { ...wt, subtypes: [...updatedSubtypes, newST] };
          }),
        })),
      );
      return newST;
    },
    [],
  );

  /** Edit a subtype's value */
  const updateSubtype = useCallback(
    async ({ workTypeKey, subtypeId, value }) => {
      const updated = await apiFetch(
        `${BASE}/work-types/${workTypeKey}/subtypes/${subtypeId}`,
        "PATCH",
        { value },
      );
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          workTypes: (cat.workTypes ?? []).map((wt) => {
            if (wt.key !== workTypeKey) return wt;
            return {
              ...wt,
              subtypes: (wt.subtypes ?? []).map((s) =>
                s._id === subtypeId ? { ...s, value: updated.value } : s,
              ),
            };
          }),
        })),
      );
      return updated;
    },
    [],
  );

  /** Delete a custom subtype */
  const deleteSubtype = useCallback(async ({ workTypeKey, subtypeId }) => {
    await apiFetch(`${BASE}/work-types/${workTypeKey}/subtypes/${subtypeId}`, "DELETE");
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes ?? []).map((wt) => {
          if (wt.key !== workTypeKey) return wt;
          return {
            ...wt,
            subtypes: (wt.subtypes ?? []).filter((s) => s._id !== subtypeId),
          };
        }),
      })),
    );
  }, []);

  /** Set a subtype as the default for its work type */
  const setDefaultSubtype = useCallback(async ({ workTypeKey, subtypeId }) => {
    const updated = await apiFetch(
      `${BASE}/work-types/${workTypeKey}/subtypes/${subtypeId}/set-default`,
      "PATCH",
    );
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        workTypes: (cat.workTypes ?? []).map((wt) => {
          if (wt.key !== workTypeKey) return wt;
          return {
            ...wt,
            subtypes: (wt.subtypes ?? []).map((s) => ({
              ...s,
              isDefault: s._id === subtypeId,
            })),
          };
        }),
      })),
    );
    return updated;
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────────

  const value = {
    categories,
    loading,
    error,
    refetch: fetchAll,
    // Read helpers
    getCategoryWorkTypes,
    getSubtypes,
    getDefaultSubtype,
    // Category mutations
    createCategory,
    updateCategory,
    deleteCategory,
    // WorkType mutations
    createWorkType,
    updateWorkType,
    deleteWorkType,
    // Subtype mutations
    createSubtype,
    updateSubtype,
    deleteSubtype,
    setDefaultSubtype,
  };

  return (
    <WorkTypeTaxonomyContext.Provider value={value}>
      {children}
    </WorkTypeTaxonomyContext.Provider>
  );
}

WorkTypeTaxonomyProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkTypeTaxonomy() {
  const ctx = useContext(WorkTypeTaxonomyContext);
  if (!ctx) {
    throw new Error(
      "useWorkTypeTaxonomy must be used within a <WorkTypeTaxonomyProvider>. " +
        "Wrap your Calculator (or App) with <WorkTypeTaxonomyProvider>.",
    );
  }
  return ctx;
}
