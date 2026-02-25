// src/context/SettingsContext.jsx
// FIX: DEFAULT_SETTINGS was missing every field that the CalculatorEngine reads
//      from settings (taxRate, laborDiscount, wasteFactor, wasteEntries, markup,
//      transportationFee, miscFees, payments).  Without these defaults, any
//      component that calls useSettings() on a freshly initialised provider
//      passes an incomplete object to the engine, causing it to fall through to
//      its own internal defaults — but only after a redundant null-check cycle.
//
// EXPORT NOTE: The raw `SettingsContext` object is exported so that components
// rendered both inside and outside this provider (e.g. CostBreakdown) can call
// useContext(SettingsContext) and receive null when no provider is present,
// rather than throwing.

import React, { createContext, useContext, useState, useCallback } from "react";
import PropTypes from "prop-types";

// Exported so components can call useContext(SettingsContext) directly when
// they need to handle the "outside provider" case gracefully (returns null).
export const SettingsContext = createContext(null);

export const DEFAULT_SETTINGS = {
  // UI / display preferences
  currency: "USD",
  showAdvancedOptions: false,
  theme: "light",
  autoSave: true,
  notifications: true,

  // Legacy fields kept for backward compatibility
  laborMultiplier: 1,
  materialMarkup: 0,

  // ── Engine-required fields ───────────────────────────────────────────────
  // These match the fields read in CalculatorEngine._validateSettings() and
  // _calculateAdjustments() / _calculateWaste().
  taxRate: 0, // stored as decimal, e.g. 0.08 = 8%
  laborDiscount: 0, // stored as decimal, e.g. 0.10 = 10%
  wasteFactor: 0, // global fallback waste multiplier (decimal)
  wasteEntries: [], // per-surface waste entries (used first if non-empty)
  markup: 0, // stored as decimal, e.g. 0.15 = 15%
  transportationFee: 0, // flat dollar amount
  miscFees: [], // [{ name: string, amount: number }]
  deposit: 0, // flat dollar amount
  depositDate: null, // ISO date string or null
  payments: [], // payment records
};

export function SettingsProvider({ children, initialSettings = {} }) {
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSettings = useCallback((newSettings) => {
    if (typeof newSettings !== "object" || newSettings === null) {
      console.warn("Invalid settings object:", newSettings);
      return;
    }
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Resets ALL settings to DEFAULT_SETTINGS — always complete and in sync.
  // Use this instead of calling setSettings({...partial object...}).
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const resetSetting = useCallback((key) => {
    if (key in DEFAULT_SETTINGS) {
      setSettings((prev) => ({ ...prev, [key]: DEFAULT_SETTINGS[key] }));
    } else {
      console.warn(`Unknown setting key: ${key}`);
    }
  }, []);

  const getSetting = useCallback(
    (key, defaultValue = null) => {
      return settings[key] !== undefined ? settings[key] : defaultValue;
    },
    [settings],
  );

  const hasSetting = useCallback(
    (key) => {
      return key in settings;
    },
    [settings],
  );

  const value = {
    settings,
    setSettings,
    updateSetting,
    updateSettings,
    resetSettings,
    resetSetting,
    getSetting,
    hasSetting,
    defaultSettings: DEFAULT_SETTINGS,
    settingsKeys: Object.keys(settings),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

SettingsProvider.propTypes = {
  children: PropTypes.node.isRequired,
  initialSettings: PropTypes.object,
};

// Preferred hook for components always inside the provider.
// Components that may render outside the provider should call
// useContext(SettingsContext) directly and handle the null case.
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
