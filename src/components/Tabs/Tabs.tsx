import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import styles from './Tabs.module.css';

export interface Tab {
  id: string;
  label: string;
  isActive: boolean;
  closable?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  onTabClick: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onTabCreate?: (tabType: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, onTabClick, onTabClose, onTabCreate }) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (onTabClose) {
      onTabClose(tabId);
    }
  };

  const handleNewTabClick = () => {
    setShowNewTabMenu(!showNewTabMenu);
  };

  const handleTabTypeSelect = (tabType: string) => {
    setShowNewTabMenu(false);
    if (onTabCreate) {
      onTabCreate(tabType);
    }
  };

  const handleCreateProject = () => {
    setShowNewTabMenu(false);
    // Por enquanto não faz nada, como solicitado
    console.log('Criar projeto clicado - funcionalidade a implementar');
  };

  // Filtrar opções disponíveis (não mostrar abas já abertas)
  const availableTabTypes = [
    { id: 'investimentos', label: 'Investimentos' },
    { id: 'empresa', label: 'Empresa' }
  ].filter(tabType => !tabs.some(tab => tab.id === tabType.id));

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewTabMenu(false);
      }
    };

    if (showNewTabMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewTabMenu]);

  useEffect(() => {
    tabs.forEach((tab, index) => {
      const element = tabRefs.current[index];
      if (!element) return;

      // Criar elemento de luz
      const light = document.createElement('div');
      light.style.position = 'absolute';
      light.style.top = '0';
      light.style.left = '0';
      light.style.width = '100%';
      light.style.height = '100%';
      light.style.background = 'linear-gradient(45deg, transparent, rgba(255,255,255,0.2), transparent)';
      light.style.transform = 'translateX(-100%)';
      light.style.pointerEvents = 'none';
      light.style.borderRadius = 'inherit';
      light.className = 'tab-light';
      
      element.style.position = 'relative';
      element.style.overflow = 'hidden';
      
      // Remover luz existente se houver
      const existingLight = element.querySelector('.tab-light');
      if (existingLight) {
        existingLight.remove();
      }
      
      element.appendChild(light);

      // Animação de hover
      const handleMouseEnter = () => {
        if (!tab.isActive) {
          gsap.to(element, {
            scale: 1.02,
            duration: 0.2,
            ease: 'power2.out'
          });
        }
        
        // Animação da luz
        gsap.to(light, {
          x: '200%',
          duration: 0.6,
          ease: 'power2.out'
        });
      };

      const handleMouseLeave = () => {
        if (!tab.isActive) {
          gsap.to(element, {
            scale: 1,
            duration: 0.2,
            ease: 'power2.out'
          });
        }
        
        // Reset da luz
        gsap.set(light, {
          x: '-100%'
        });
      };

      const handleClick = () => {
        gsap.to(element, {
          scale: 0.95,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out'
        });
      };

      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
      element.addEventListener('click', handleClick);

      return () => {
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
        element.removeEventListener('click', handleClick);
        if (element.contains(light)) {
          element.removeChild(light);
        }
      };
    });
  }, [tabs]);

  // Animação da sombra para aba ativa
  useEffect(() => {
    // Limpar todas as animações anteriores
    tabRefs.current.forEach((element) => {
      if (element) {
        gsap.killTweensOf(element);
      }
    });

    tabs.forEach((tab, index) => {
      const element = tabRefs.current[index];
      if (!element) return;

      if (tab.isActive) {
        // Animação suave da sombra para aba ativa com roxo mais suave
        gsap.to(element, {
          boxShadow: '0 2px 12px rgba(139, 92, 246, 0.15), 0 0 20px rgba(139, 92, 246, 0.05)',
          duration: 0.8,
          ease: 'power2.inOut'
        });

        // Animação pulsante sutil na sombra com roxo mais suave
        const pulseAnimation = () => {
          gsap.to(element, {
            boxShadow: '0 3px 15px rgba(139, 92, 246, 0.2), 0 0 25px rgba(139, 92, 246, 0.08)',
            duration: 2.5,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1
          });
        };

        // Iniciar animação pulsante após um pequeno delay
        const timeout = setTimeout(pulseAnimation, 100);

        return () => {
          clearTimeout(timeout);
        };
      } else {
        // Resetar sombra para abas inativas
        gsap.to(element, {
          boxShadow: 'none',
          duration: 0.5,
          ease: 'power2.out'
        });
      }
    });
  }, [tabs]);

  return (
    <div className={styles.tabsContainer}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => { tabRefs.current[index] = el; }}
          className={`${styles.tab} ${tab.isActive ? styles.active : ''}`}
          onClick={() => onTabClick(tab.id)}
        >
          <span className={styles.tabLabel}>{tab.label}</span>
          {tab.closable && (
            <button
              className={styles.closeButton}
              onClick={(e) => handleTabClose(e, tab.id)}
              aria-label={`Fechar aba ${tab.label}`}
            >
              ×
            </button>
          )}
        </button>
      ))}
      
      {/* Botão de adicionar nova aba */}
      <div className={styles.newTabContainer} ref={menuRef}>
        <button
          className={styles.newTabButton}
          onClick={handleNewTabClick}
          aria-label="Adicionar nova aba"
        >
          +
        </button>
        
        {/* Menu dropdown */}
        {showNewTabMenu && (
          <div className={styles.newTabMenu}>
            {/* Opção "Criar projeto" sempre visível e destacada */}
            <button
              className={`${styles.menuItem} ${styles.createProject}`}
              onClick={handleCreateProject}
            >
              Criar projeto
            </button>
            
            {/* Opções de abas disponíveis (não abertas ainda) */}
            {availableTabTypes.map(tabType => (
              <button
                key={tabType.id}
                className={styles.menuItem}
                onClick={() => handleTabTypeSelect(tabType.id)}
              >
                {tabType.label}
              </button>
            ))}
            
            {/* Mensagem se não há abas disponíveis */}
            {availableTabTypes.length === 0 && (
              <div className={styles.noOptions}>
                Todas as abas já estão abertas
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tabs;
