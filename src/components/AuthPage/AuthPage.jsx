// src/components/AuthPage/AuthPage.jsx
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import styles from './AuthPage.module.css';
import SignUpForm from '../SignUpForm/SignUpForm';
import LoginForm from '../LoginForm/LoginForm';

export default function AuthPage({ setUser, toggleDarkMode, isDarkMode }) {
  const [showLogin, setShowLogin] = useState(true);
  const [animate, setAnimate] = useState(false);

  const handleToggle = (isLogin) => {
    if (isLogin === showLogin) return;
    setAnimate(true);
    setTimeout(() => {
      setShowLogin(isLogin);
      setAnimate(false);
    }, 220);
  };

  return (
    <main className={styles.AuthPage}>
      {/* Ambient orbs */}
      <div className={styles.ambientOrb} aria-hidden="true" />
      <div className={styles.ambientOrb2} aria-hidden="true" />

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Rawdah Remodeling</h1>
          <p className={styles.subtitle}>Professional Project Management</p>
        </div>

        {/* Toggle */}
        <div className={styles.toggleContainer} role="tablist" aria-label="Authentication mode">
          <button
            role="tab"
            aria-selected={showLogin}
            className={`${styles.toggleButton} ${showLogin ? styles.active : ''}`}
            onClick={() => handleToggle(true)}
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={!showLogin}
            className={`${styles.toggleButton} ${!showLogin ? styles.active : ''}`}
            onClick={() => handleToggle(false)}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <div
          className={`${styles.formWrapper} ${animate ? styles.animate : ''}`}
          role="tabpanel"
        >
          {showLogin ? (
            <LoginForm setUser={setUser} />
          ) : (
            <SignUpForm setUser={setUser} />
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <p>Secured by Enterprise Encryption</p>
          <button
            className={styles.darkModeToggle}
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} />
          </button>
        </div>
      </div>
    </main>
  );
}