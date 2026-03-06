import React from 'react';
import { Search, Bell, User } from 'lucide-react';
import styles from './TopBar.module.css';

interface TopBarProps {
  title: string;
}

const TopBar: React.FC<TopBarProps> = ({ title }) => {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
      
      <div className={styles.topBarRight}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar..."
            className={styles.searchInput}
          />
        </div>
        
        <button className={styles.notificationBtn}>
          <Bell size={20} />
          <span className={styles.notificationBadge}>3</span>
        </button>
        
        <div className={styles.userMenu}>
          <div className={styles.userAvatar}>
            <User size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
