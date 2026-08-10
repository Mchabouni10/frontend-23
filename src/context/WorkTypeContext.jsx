// src/context/WorkTypeContext.jsx
import React, { createContext, useContext, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useWorkTypeTaxonomy } from "./WorkTypeTaxonomyContext";

import {
  MEASUREMENT_TYPES,
  isValidMeasurementType as validateMeasurementType,
  getMeasurementTypeLabel as getTypeLabel,
  getMeasurementTypeUnit as getTypeUnit,
  getMeasurementTypeIcon as getTypeIcon,
  ALL_MEASUREMENT_TYPES,
} from "../constants/measurementTypes";

const WorkTypeContext = createContext({
  getCategoryWorkTypes: () => [],
  getSubtypeOptions: () => [],
  getDefaultSubtype: () => null,
  isCategoryValid: () => false,
  isValidWorkType: () => false,
  getMeasurementType: () => null,
  getAllMeasurementTypes: () => [],
  getMeasurementTypeLabel: () => "",
  getMeasurementTypeUnit: () => "",
  getMeasurementTypeIcon: () => "",
  isValidMeasurementType: () => false,
  isValidSubtype: () => true,
  getWorkTypeDetails: () => null,
  workTypesData: {},
  categories: [],
  measurementTypes: [],
  // ── NEW: taxonomy loading / error state exposed here ──────────────────────
  taxonomyLoading: true,
  taxonomyError: null,
  taxonomyReady: false,
});

export function WorkTypeProvider({ children }) {
  const {
    categories: taxonomy,
    loading: taxonomyLoading, // ← NEW: forwarded from taxonomy context
    error: taxonomyError, // ← NEW: forwarded from taxonomy context
    getCategoryWorkTypes: taxGetCategoryWorkTypes,
    getSubtypes: taxGetSubtypes,
    getDefaultSubtype: taxGetDefaultSubtype,
  } = useWorkTypeTaxonomy();

  // taxonomyReady is true only when the API fetch has finished AND returned data.
  // This is the single gating flag that HomePage (and anything else) should use
  // instead of checking whether the functions exist (they always exist immediately).
  const taxonomyReady =
    !taxonomyLoading && !taxonomyError && taxonomy.length > 0;

  const isCategoryValid = useCallback(
    (categoryKey) => taxonomy.some((c) => c.key === categoryKey),
    [taxonomy],
  );

  const isValidWorkType = useCallback(
    (categoryKey, workTypeKey) => {
      if (!categoryKey || !workTypeKey) return false;
      const cat = taxonomy.find((c) => c.key === categoryKey);
      if (!cat) return false;
      return cat.workTypes?.some((w) => w.key === workTypeKey) ?? false;
    },
    [taxonomy],
  );

  const getWorkTypeDetails = useCallback(
    (workTypeKey) => {
      if (!workTypeKey) return null;
      let categoryKey = null;
      let workTypeObj = null;

      for (const cat of taxonomy) {
        const wt = cat.workTypes?.find((w) => w.key === workTypeKey);
        if (wt) {
          categoryKey = cat.key;
          workTypeObj = wt;
          break;
        }
      }

      if (!workTypeObj) return null;

      const subtypes = workTypeObj.subtypes || [];
      const defaultSt = subtypes.find((s) => s.isDefault);

      return {
        type: workTypeKey,
        category: categoryKey,
        subtypes: subtypes.map((s) => s.value),
        defaultSubtype: defaultSt
          ? defaultSt.value
          : subtypes[0]?.value || null,
      };
    },
    [taxonomy],
  );

  const isValidSubtype = useCallback(
    (workTypeKey, subtypeValue) => {
      if (!workTypeKey || !subtypeValue) return true;
      const subtypes = taxGetSubtypes(workTypeKey);
      if (!subtypes || subtypes.length === 0) return true;
      return subtypes.some((s) => s.value === subtypeValue);
    },
    [taxGetSubtypes],
  );

  const getCategoryWorkTypes = useCallback(
    (categoryKey) => taxGetCategoryWorkTypes(categoryKey).map((wt) => wt.key),
    [taxGetCategoryWorkTypes],
  );

  const getSubtypeOptions = useCallback(
    (workTypeKey) => taxGetSubtypes(workTypeKey).map((st) => st.value),
    [taxGetSubtypes],
  );

  const getDefaultSubtype = useCallback(
    (workTypeKey) => taxGetDefaultSubtype(workTypeKey),
    [taxGetDefaultSubtype],
  );

  const getAllMeasurementTypes = useCallback(() => ALL_MEASUREMENT_TYPES, []);

  const getMeasurementTypeLabel = useCallback(
    (measurementType) => getTypeLabel(measurementType),
    [],
  );

  const getMeasurementTypeUnit = useCallback(
    (measurementType) => getTypeUnit(measurementType),
    [],
  );

  const getMeasurementTypeIcon = useCallback(
    (measurementType) => getTypeIcon(measurementType),
    [],
  );

  const getMeasurementType = useCallback(
    (categoryName, workTypeKey) => {
      if (!workTypeKey) return MEASUREMENT_TYPES.SQUARE_FOOT;

      for (const cat of taxonomy) {
        const wt = cat.workTypes?.find((w) => w.key === workTypeKey);
        if (wt && wt.measurementType) {
          if (wt.measurementType === "square-foot")
            return MEASUREMENT_TYPES.SQUARE_FOOT;
          if (wt.measurementType === "linear-foot")
            return MEASUREMENT_TYPES.LINEAR_FOOT;
          if (wt.measurementType === "by-unit")
            return MEASUREMENT_TYPES.BY_UNIT;
          return wt.measurementType;
        }
      }

      const lowerWorkType = workTypeKey.toLowerCase();

      if (
        lowerWorkType.includes("flooring") ||
        lowerWorkType.includes("tile") ||
        lowerWorkType.includes("carpet") ||
        lowerWorkType.includes("countertop") ||
        lowerWorkType.includes("backsplash") ||
        lowerWorkType.includes("ceiling") ||
        lowerWorkType.includes("walls") ||
        lowerWorkType.includes("surface")
      ) {
        return MEASUREMENT_TYPES.SQUARE_FOOT;
      }

      if (
        lowerWorkType.includes("trim") ||
        lowerWorkType.includes("molding") ||
        lowerWorkType.includes("baseboard") ||
        lowerWorkType.includes("crown") ||
        lowerWorkType.includes("edge") ||
        lowerWorkType.includes("pipe") ||
        lowerWorkType.includes("strip")
      ) {
        return MEASUREMENT_TYPES.LINEAR_FOOT;
      }

      if (
        lowerWorkType.includes("outlet") ||
        lowerWorkType.includes("switch") ||
        lowerWorkType.includes("appliance") ||
        lowerWorkType.includes("fixture") ||
        lowerWorkType.includes("sink") ||
        lowerWorkType.includes("toilet") ||
        lowerWorkType.includes("door") ||
        lowerWorkType.includes("window") ||
        lowerWorkType.includes("fan") ||
        lowerWorkType.includes("bar") ||
        lowerWorkType.includes("mirror") ||
        lowerWorkType.includes("hardware") ||
        lowerWorkType.includes("organizer") ||
        lowerWorkType.includes("lighting")
      ) {
        return MEASUREMENT_TYPES.BY_UNIT;
      }

      if (categoryName) {
        const lowerCategory = categoryName.toLowerCase();
        if (lowerCategory.includes("electric"))
          return MEASUREMENT_TYPES.BY_UNIT;
        if (lowerCategory.includes("plumb")) return MEASUREMENT_TYPES.BY_UNIT;
      }

      return MEASUREMENT_TYPES.SQUARE_FOOT;
    },
    [taxonomy],
  );

  const isValidMeasurementType = useCallback(
    (measurementType) => validateMeasurementType(measurementType),
    [],
  );

  const contextValue = useMemo(
    () => ({
      getCategoryWorkTypes,
      getSubtypeOptions,
      getDefaultSubtype,
      isCategoryValid,
      isValidWorkType,
      isValidSubtype,
      getWorkTypeDetails,
      getMeasurementType,
      isValidMeasurementType,
      getAllMeasurementTypes,
      getMeasurementTypeLabel,
      getMeasurementTypeUnit,
      getMeasurementTypeIcon,
      workTypesData: {},
      categories: taxonomy.map((c) => c.key),
      measurementTypes: ALL_MEASUREMENT_TYPES,
      // ── Taxonomy loading state — use these to gate on "data is ready" ─────
      taxonomyLoading,
      taxonomyError,
      taxonomyReady,
    }),
    [
      getCategoryWorkTypes,
      getSubtypeOptions,
      getDefaultSubtype,
      isCategoryValid,
      isValidWorkType,
      isValidSubtype,
      getWorkTypeDetails,
      getMeasurementType,
      isValidMeasurementType,
      getAllMeasurementTypes,
      getMeasurementTypeLabel,
      getMeasurementTypeUnit,
      getMeasurementTypeIcon,
      taxonomy,
      taxonomyLoading,
      taxonomyError,
      taxonomyReady,
    ],
  );

  return (
    <WorkTypeContext.Provider value={contextValue}>
      {children}
    </WorkTypeContext.Provider>
  );
}

WorkTypeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useWorkType = () => {
  const context = useContext(WorkTypeContext);
  if (!context) {
    throw new Error("useWorkType must be used within a WorkTypeProvider");
  }
  return context;
};

export { MEASUREMENT_TYPES };
