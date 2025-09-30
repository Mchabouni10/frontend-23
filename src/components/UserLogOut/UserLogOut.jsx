import React from 'react';
import { logOut } from '../../utilities/users-service';
import styles from './UserLogOut.module.css';

export default function UserLogOut({ user, setUser }) {
  function handleLogOut() {
    logOut();
    setUser(null);
  }

  return (
    <div className={styles.userLogOut}>
      <div className={styles.userDetails}>
        <div className={styles.userName}>
          <span className={styles.label}>User:</span> {user.name}
        </div>
        <div className={styles.userEmail}>
          <span className={styles.label}>ID:</span> {user.email}
        </div>
      </div>
      <button 
        className={styles.logoutButton} 
        onClick={handleLogOut}
      >
        <span>Terminate Session</span>
        <span className={styles.logoutIcon}>→</span>
      </button>
    </div>
  );
}