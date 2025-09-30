// src/components/Navbar/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUsers, faPlusCircle, faFileAlt, faMoon, faSun, faChartPie } from '@fortawesome/free-solid-svg-icons';
import styles from './Navbar.module.css';

export default function Navbar({ user, setUser, toggleDarkMode, isDarkMode }) {
  const location = useLocation();
  // Fix the regex to capture project ID correctly
  const projectId = location.pathname.match(/\/home\/(customer|edit)\/([^/]+)/)?.[2];

  return (
    <nav className={styles.navbar}>
      <div className={styles.logoContainer}>
        <span className={styles.logo}>Remodel Pro</span>
        <span className={styles.logoSubtitle}>Project Management</span>
      </div>

      <ul className={styles.navLinks}>
        <li>
          <Link to="/home/customers" className={styles.navLink}>
            <FontAwesomeIcon icon={faUsers} className={styles.navIcon} />
            <span>Customers</span>
          </Link>
        </li>
        <li>
          <Link to="/home/new-customer-project" className={styles.navLink}>
            <FontAwesomeIcon icon={faPlusCircle} className={styles.navIcon} />
            <span>New Project</span>
          </Link>
        </li>
        {projectId && (
          <li>
            <Link to={`/home/print/${projectId}`} className={styles.navLink}>
              <FontAwesomeIcon icon={faFileAlt} className={styles.navIcon} />
              <span>Print/Estimate</span>
            </Link>
          </li>
        )}
        <li>
          <Link to="/home/finance" className={styles.navLink}>
            <FontAwesomeIcon icon={faChartPie} className={styles.navIcon} />
            <span>Finance Data</span>
          </Link>
        </li>
        <li>
          <button onClick={toggleDarkMode} className={styles.toggleButton}>
            <FontAwesomeIcon
              icon={isDarkMode ? faSun : faMoon}
              className={styles.toggleIcon}
            />
            <span>{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>
        </li>
        <li>
          <Link to="/logout" className={`${styles.navLink} ${styles.logoutLink}`}>
            <FontAwesomeIcon icon={faSignOutAlt} className={styles.navIcon} />
            <span>{user.name}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}