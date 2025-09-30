import React, { useState } from 'react';
import { signUp } from '../../utilities/users-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import styles from './SignUpForm.module.css';

export default function SignUpForm({ setUser }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (evt) => {
    setFormData({
      ...formData,
      [evt.target.name]: evt.target.value,
    });
    setError('');
  };

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setIsLoading(true);
    try {
      const user = await signUp(formData);
      setUser(user);
    } catch {
      setError('Registration Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const disable = formData.password !== formData.confirm || !formData.name || !formData.email;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className={styles.formContainer}>
      <form autoComplete="off" onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.title}>Create Profile</h2>

        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faUser} className={styles.inputIcon} />
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your identifier"
            required
            className={styles.input}
          />
        </div>

        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faEnvelope} className={styles.inputIcon} />
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
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
            value={formData.password}
            onChange={handleChange}
            placeholder="Create security key"
            required
            className={styles.input}
          />
          <FontAwesomeIcon
            icon={showPassword ? faEyeSlash : faEye}
            className={styles.passwordToggleIcon}
            onClick={togglePasswordVisibility}
          />
        </div>

        <div className={styles.inputGroup}>
          <FontAwesomeIcon icon={faLock} className={styles.inputIcon} />
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirm"
            name="confirm"
            value={formData.confirm}
            onChange={handleChange}
            placeholder="Confirm security key"
            required
            className={styles.input}
          />
          <FontAwesomeIcon
            icon={showConfirmPassword ? faEyeSlash : faEye}
            className={styles.passwordToggleIcon}
            onClick={toggleConfirmPasswordVisibility}
          />
        </div>

        <button
          type="submit"
          disabled={disable || isLoading}
          className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
        >
          {isLoading ? (
            <span className={styles.loader}></span>
          ) : (
            'Activate Profile'
          )}
        </button>

        {error && <p className={styles.errorMessage}>{error}</p>}
      </form>
    </div>
  );
}