//src/context/SettingsContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

const SettingsContext = createContext();

// Default settings structure
const DEFAULT_SETTINGS = {
  currency: 'USD',
  taxRate: 0,
  laborMultiplier: 1,
  materialMarkup: 0,
  showAdvancedOptions: false,
  theme: 'light',
  autoSave: true,
  notifications: true
};

export function SettingsProvider({ children, initialSettings = {} }) {
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    ...initialSettings
  });

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateSettings = useCallback((newSettings) => {
    if (typeof newSettings !== 'object' || newSettings === null) {
      console.warn('Invalid settings object:', newSettings);
      return;
    }
    
    setSettings((prev) => ({
      ...prev,
      ...newSettings
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const resetSetting = useCallback((key) => {
    if (key in DEFAULT_SETTINGS) {
      setSettings((prev) => ({
        ...prev,
        [key]: DEFAULT_SETTINGS[key]
      }));
    } else {
      console.warn(`Unknown setting key: ${key}`);
    }
  }, []);

  const getSetting = useCallback((key, defaultValue = null) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  const hasSetting = useCallback((key) => {
    return key in settings;
  }, [settings]);

  const value = {
    settings,
    setSettings,
    updateSetting,
    updateSettings,
    resetSettings,
    resetSetting,
    getSetting,
    hasSetting,
    // Helper properties
    defaultSettings: DEFAULT_SETTINGS,
    settingsKeys: Object.keys(settings)
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

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};