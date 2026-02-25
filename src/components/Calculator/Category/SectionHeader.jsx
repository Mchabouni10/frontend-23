import React from "react";
import styles from "./SectionHeader.module.css";

/**
 * Premium reusable section header component for consistent styling across all calculator sections
 *
 * @param {string} title - The main header title
 * @param {string} icon - Font Awesome icon class (e.g., 'fas fa-list')
 * @param {boolean} isExpanded - Whether the section is expanded
 * @param {function} onToggle - Callback when toggle button is clicked
 * @param {Array} stats - Array of stat objects to display in header
 *   Each stat object: { icon: string, value: string|number, label: string (optional), highlight: boolean (optional), className: string (optional) }
 * @param {React.ReactNode} rightContent - Optional custom content to display on the right side (overrides stats)
 * @param {string} className - Additional CSS classes for the header
 * @param {boolean} disabled - Whether the header should be disabled
 */
export default function SectionHeader({
  title,
  icon,
  isExpanded,
  onToggle,
  stats = [],
  rightContent,
  className = "",
  disabled = false,
}) {
  return (
    <div className={`${styles.header} ${className}`.trim()}>
      <button
        className={`${styles.toggleButton} ${disabled ? styles.disabled : ""}`}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isExpanded}
        aria-label={`Toggle ${title}`}
      >
        <i className={`fas fa-chevron-${isExpanded ? "down" : "right"}`} />
      </button>

      <div className={styles.titleSection}>
        {icon && <i className={`${icon} ${styles.icon}`} />}
        <h3 className={styles.title}>{title}</h3>
      </div>

      <div className={styles.rightContent}>
        {rightContent ? (
          rightContent
        ) : stats.length > 0 ? (
          <div className={styles.statsContainer}>
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`${styles.statItem} ${
                  stat.highlight ? styles.highlight : ""
                } ${stat.className || ""}`.trim()}
                title={stat.label}
              >
                {stat.icon && (
                  <i className={`${stat.icon} ${styles.statIcon}`} />
                )}
                <span
                  className={`${styles.statValue} ${
                    stat.valueClassName || ""
                  }`.trim()}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
