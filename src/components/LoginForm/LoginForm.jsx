import React, { useState } from 'react';
import { login } from '../../utilities/users-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
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
      setError('Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={styles.formContainer}>
      <form autoComplete="off" onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>Access Portal</h2>
        
        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faEnvelope} className={styles.inputIcon} />
          <input
            type="email"
            id="email"
            name="email"
            value={credentials.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
            className={styles.input}
          />
        </div>

        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faLock} className={styles.inputIcon} />
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            placeholder="Enter security key"
            required
            className={styles.input}
          />
          <FontAwesomeIcon
            icon={showPassword ? faEyeSlash : faEye}
            className={styles.passwordToggleIcon}
            onClick={togglePasswordVisibility}
          />
        </div>

        <button
          type="submit"
          className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className={styles.loader}></span>
          ) : (
            'Initialize Access'
          )}
        </button>

        {error && <p className={styles.errorMessage}>{error}</p>}
      </form>
    </div>
  );
}
