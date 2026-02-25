import React, { useState } from 'react';
import { login } from '../../utilities/users-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import styles from './LoginForm.module.css';

export default function LoginForm({ setUser }) {
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (evt) => {
    setCredentials({
      ...credentials,
      [evt.target.name]: evt.target.value,
    });
    setError('');
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setIsLoading(true);
    try {
      const user = await login(credentials);
      setUser(user);
    } catch {
      setError('Invalid credentials — please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <form autoComplete="off" onSubmit={handleSubmit} className={styles.form}>

        {/* Email */}
        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faEnvelope} className={styles.inputIcon} />
          <input
            type="email"
            id="email"
            name="email"
            value={credentials.email}
            onChange={handleChange}
            placeholder="Email address"
            required
            className={styles.input}
            autoComplete="email"
          />
        </div>

        {/* Password */}
        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faLock} className={styles.inputIcon} />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            placeholder="Password"
            required
            className={styles.input}
            autoComplete="current-password"
          />
          <FontAwesomeIcon
            icon={showPassword ? faEyeSlash : faEye}
            className={styles.passwordToggleIcon}
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? 'Hide password' : 'Show password'}
          />
        </div>

        {/* Forgot password */}
        <div className={styles.helperRow}>
          <button type="button" className={styles.helperLink}>
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className={styles.loader} />
          ) : (
            <>
              Access Account
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: '0.75em', opacity: 0.85 }} />
            </>
          )}
        </button>

        {error && (
          <p className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
