import React from 'react';
import { Home, History, GitCompare, FileText, Plus, Trophy, Settings } from 'lucide-react';
import type { NavigationItem } from '../../types/navigation';
import styles from './MinimalSidebar.module.css';

interface MinimalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentScreen?: NavigationItem;
  onNavigation?: (screen: NavigationItem) => void;
}

const MinimalSidebar = ({ 
  isOpen = false, 
  onClose,
  currentScreen = 'home',
  onNavigation
}: MinimalSidebarProps) => {
  const menuItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'history' as const, label: 'Histórico de Transação', icon: History },
    { id: 'comparison' as const, label: 'Comparação', icon: GitCompare },
    { id: 'reports' as const, label: 'Relatórios', icon: FileText },
    { id: 'creation' as const, label: 'Criação', icon: Plus },
    { id: 'achievements' as const, label: 'Conquistas', icon: Trophy },
    { id: 'settings' as const, label: 'Configurações', icon: Settings },
  ];

  const handleNavigation = (itemId: NavigationItem) => {
    if (onNavigation) {
      onNavigation(itemId);
    }
  };

  return (
    <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <button 
              key={item.id}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => handleNavigation(item.id)}
              title={item.label}
            >
              <Icon size={40} />
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MinimalSidebar;
