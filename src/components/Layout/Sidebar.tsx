import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  FileText, 
  Settings,
  TrendingUp
} from 'lucide-react';
import type { AppState } from '../../types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  currentSection: AppState['currentSection'];
  onSectionChange: (section: AppState['currentSection']) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentSection, onSectionChange }) => {
  const menuItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions' as const, label: 'Transações', icon: Receipt },
    { id: 'reports' as const, label: 'Relatórios', icon: FileText },
    { id: 'settings' as const, label: 'Configurações', icon: Settings },
  ];

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <TrendingUp size={24} />
          <span>FinancePro</span>
        </div>
      </div>
      
      <nav className={styles.sidebarNav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          
          return (
            <button
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => onSectionChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            <span>U</span>
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>Usuário</div>
            <div className={styles.userRole}>Premium</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
