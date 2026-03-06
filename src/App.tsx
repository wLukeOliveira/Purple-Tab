import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import MinimalSidebar from './components/MinimalSidebar/MinimalSidebar';
import MainContent from './components/MainContent/MainContent';
import Tabs from './components/Tabs/Tabs';
import type { NavigationItem } from './types/navigation';
import type { Tab } from './components/Tabs/Tabs';
import styles from './App.module.css';
import logo from './assets/logo.png';
import brazilFlag from './assets/brazil-flag.svg';
import usaFlag from './assets/usa-flag.svg';

function App() {
  const [currentScreen, setCurrentScreen] = useState<NavigationItem>('home');
  const [currentLanguage, setCurrentLanguage] = useState<'pt' | 'en'>('pt');
  const [currentCurrency, setCurrentCurrency] = useState<'BRL' | 'USD' | 'EUR'>('BRL');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('geral');
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'geral', label: 'Geral', isActive: true, closable: false },
    { id: 'empresa', label: 'Empresa', isActive: false, closable: true }
  ]);
  
  // Mock data para variação percentual
  const [percentageChange] = useState({
    value: 2.550,
    period: 'dia' as 'dia' | 'mes' | 'ano'
  });
  
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, isActive: tab.id === tabId }))
    );
  };

  const handleTabClose = (tabId: string) => {
    setTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      // Se a aba ativa for fechada, ativa a primeira aba restante
      if (activeTab === tabId && newTabs.length > 0) {
        const newActiveTab = newTabs[0].id;
        setActiveTab(newActiveTab);
        return newTabs.map(tab => ({ ...tab, isActive: tab.id === newActiveTab }));
      }
      return newTabs;
    });
  };

  const handleTabCreate = (tabType: string) => {
    const newTabId = tabType.toLowerCase();
    const newTabLabel = tabType.charAt(0).toUpperCase() + tabType.slice(1);
    
    setTabs(prevTabs => {
      // Verificar se a aba já existe
      const existingTab = prevTabs.find(tab => tab.id === newTabId);
      if (existingTab) {
        // Se já existe, apenas ativa ela
        return prevTabs.map(tab => ({ ...tab, isActive: tab.id === newTabId }));
      }
      
      // Criar nova aba
      const newTab: Tab = {
        id: newTabId,
        label: newTabLabel,
        isActive: true,
        closable: true // Todas as abas exceto "geral" podem ser fechadas
      };
      
      // Desativar todas as abas existentes e adicionar a nova
      const updatedTabs = prevTabs.map(tab => ({ ...tab, isActive: false }));
      return [...updatedTabs, newTab];
    });
    
    setActiveTab(newTabId);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const toggleLanguage = () => {
    setCurrentLanguage(prev => prev === 'pt' ? 'en' : 'pt');
  };

  const toggleCurrency = () => {
    setCurrentCurrency(prev => {
      if (prev === 'BRL') return 'USD';
      if (prev === 'USD') return 'EUR';
      return 'BRL';
    });
  };

  const getCurrencySymbol = () => {
    switch (currentCurrency) {
      case 'BRL': return 'R$';
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return 'R$';
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavigation = (screen: NavigationItem) => {
    setCurrentScreen(screen);
    console.log(`Navegando para: ${screen}`);
  };

  return (
    <div className={styles.app}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className={styles.mobileMenuBtn} onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className={styles.logo}>
            <img src={logo} alt="Finance App" className={styles.logoImage} />
          </div>
        </div>
        
        <Tabs tabs={tabs} onTabClick={handleTabClick} onTabClose={handleTabClose} onTabCreate={handleTabCreate} />
        
        <div className={styles.userInfo}>
          {/* Indicador de variação movido para a direita */}
          <div className={styles.percentageIndicator}>
            <span className={styles.percentageArrow}>↑</span>
            <span className={styles.percentageValue}>R$ {percentageChange.value.toFixed(3)}</span>
            <span className={styles.percentagePeriod}>a mais que o {percentageChange.period} anterior</span>
          </div>
          
          <button className={styles.languageSelector} onClick={toggleLanguage} title={currentLanguage === 'pt' ? 'Idioma: Português (BR)' : 'Language: English (US)'}>
            <img 
              src={currentLanguage === 'pt' ? brazilFlag : usaFlag} 
              alt={currentLanguage === 'pt' ? 'Bandeira do Brasil' : 'USA Flag'} 
              className={styles.flagIcon}
            />
          </button>
          <button className={styles.currencySelector} onClick={toggleCurrency} title={`Moeda: ${currentCurrency}`}>
            {getCurrencySymbol()}
          </button>
          <button className={styles.fullscreenBtn} onClick={toggleFullscreen} title="Tela Cheia">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <div className={styles.userAvatar}>U</div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>Usuário</div>
            <div className={styles.userRole}>Premium</div>
          </div>
        </div>
      </div>
      
      {/* Overlay para mobile */}
      {isMobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={toggleMobileMenu} />
      )}
      
      <div className={styles.mainContainer}>
        <MinimalSidebar 
          isOpen={isMobileMenuOpen} 
          onClose={toggleMobileMenu}
          currentScreen={currentScreen}
          onNavigation={handleNavigation}
        />
        <MainContent currentScreen={currentScreen} currency={currentCurrency} currencySymbol={getCurrencySymbol()} />
      </div>
    </div>
  );
}

export default App;
