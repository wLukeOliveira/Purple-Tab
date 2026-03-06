import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Maximize2, Plus, Calendar, X } from 'lucide-react';
import type { NavigationItem } from '../../types/navigation';
import { useGSAPAnimations } from '../../hooks/useGSAPAnimations';
import AnimatedNumber from '../AnimatedNumber/AnimatedNumber';
import AnimatedPercentage from '../AnimatedPercentage/AnimatedPercentage';
import Statistics from '../Statistics/Statistics';
import styles from './MainContent.module.css';

interface MainContentProps {
  currentScreen?: NavigationItem;
  currency?: 'BRL' | 'USD' | 'EUR';
  currencySymbol?: string;
}

const MainContent: React.FC<MainContentProps> = ({ 
  currentScreen = 'home',
  currency = 'BRL',
  currencySymbol = 'R$'
}) => {
  const { registerCard, registerButton } = useGSAPAnimations();
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const registerCardRef = (index: number) => (element: HTMLDivElement | null) => {
    cardRefs.current[index] = element;
    if (element) registerCard(element);
  };

  const registerButtonRef = (index: number) => (element: HTMLButtonElement | null) => {
    buttonRefs.current[index] = element;
    if (element) registerButton(element);
  };
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [periodType, setPeriodType] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('income');
  const [isFixedExpense, setIsFixedExpense] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isClosingSummary, setIsClosingSummary] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [isClosingForm, setIsClosingForm] = useState(false);
  const [clickedSubcategory, setClickedSubcategory] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [isClosingDropdown, setIsClosingDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>(['Alimentação', 'Contas', 'Lazer']);
  const [activeSubcategories, setActiveSubcategories] = useState<string[]>(['Restaurantes', 'Supermercado', 'Streaming', 'Aluguel', 'Academia']);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [isBankStackOpen, setIsBankStackOpen] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    installments: '',
    bank: '',
    account: '',
    project: '',
    category: '',
    subcategory: '',
    date: new Date().toISOString().split('T')[0],
    fixedMonths: ''
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    // Set initial period based on current date
    const now = new Date();
    if (periodType === 'monthly') {
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      setSelectedPeriod(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);
    } else if (periodType === 'yearly') {
      setSelectedPeriod(now.getFullYear().toString());
    } else {
      // For custom period, set default date range
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
      setSelectedPeriod(`${firstDay.toLocaleDateString('pt-BR')} - ${lastDay.toLocaleDateString('pt-BR')}`);
    }

    return () => clearInterval(timer);
  }, [periodType]);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleToggleForm = () => {
    // Fechar o resumo se estiver aberto com delay maior
    if (showSummary) {
      // Fechar resumo detalhado primeiro
      setClickedSubcategory(null);
      
      setIsClosingSummary(true);
      setTimeout(() => {
        setShowSummary(false);
        setIsClosingSummary(false);
        // Só abrir o formulário depois que o resumo fechou completamente
        setTimeout(() => {
          setShowTransactionForm(true);
        }, 100);
      }, 400); // Aumentado de 300 para 400
    } else {
      if (showTransactionForm) {
        setIsClosingForm(true);
        setTimeout(() => {
          setShowTransactionForm(false);
          setIsClosingForm(false);
        }, 300);
      } else {
        setShowTransactionForm(true);
      }
    }
  };

  const handleSummaryToggle = () => {
    // Fechar o formulário se estiver aberto com delay maior
    if (showTransactionForm) {
      setIsClosingForm(true);
      setTimeout(() => {
        setShowTransactionForm(false);
        setIsClosingForm(false);
        // Só abrir o resumo depois que o formulário fechou completamente
        setTimeout(() => {
          setShowSummary(true);
        }, 100);
      }, 400); // Aumentado de 300 para 400
    } else {
      if (showSummary) {
        // Fechar resumo detalhado primeiro
        setClickedSubcategory(null);
        
        setIsClosingSummary(true);
        setTimeout(() => {
          setShowSummary(false);
          setIsClosingSummary(false);
        }, 300);
      } else {
        setShowSummary(true);
      }
    }
  };

  const handlePeriodTypeChange = (newType: 'monthly' | 'yearly' | 'custom') => {
  if (newType !== periodType) {
    // Close current dropdown with animation
    if (showPeriodDropdown || showDateRangePicker) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowPeriodDropdown(false);
        setShowDateRangePicker(false);
        setIsClosingDropdown(false);
        setPeriodType(newType);
      }, 200);
    } else {
      setPeriodType(newType);
    }
  }
};

const handleMaxDateRange = () => {
  // Set start date to earliest possible (2020-01-01)
  const earliestDate = '2020-01-01';
  // Set end date to today
  const today = new Date().toISOString().split('T')[0];
  
  setStartDate(earliestDate);
  setEndDate(today);
  setSelectedPeriod(`${earliestDate.split('-').reverse().join('/')} - ${today.split('-').reverse().join('/')}`);
};

const handleDropdownToggle = () => {
  if (periodType === 'custom') {
    if (showDateRangePicker) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowDateRangePicker(false);
        setIsClosingDropdown(false);
      }, 200);
    } else {
      setShowDateRangePicker(true);
    }
  } else {
    if (showPeriodDropdown) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowPeriodDropdown(false);
        setIsClosingDropdown(false);
      }, 200);
    } else {
      setShowPeriodDropdown(true);
    }
  }
};

const handleCategoryDropdownToggle = () => {
  if (showCategoryDropdown) {
    setIsClosingDropdown(true);
    setTimeout(() => {
      setShowCategoryDropdown(false);
      setIsClosingDropdown(false);
    }, 200);
  } else {
    setShowCategoryDropdown(true);
  }
};

const handleSubcategoryDropdownToggle = () => {
  if (showSubcategoryDropdown) {
    setIsClosingDropdown(true);
    setTimeout(() => {
      setShowSubcategoryDropdown(false);
      setIsClosingDropdown(false);
    }, 200);
  } else {
    setShowSubcategoryDropdown(true);
  }
};

// Fechar dropdowns ao clicar fora (mas não ao clicar nos itens)
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    
    // Fechar dropdown de categoria se clicar fora E não for um item do dropdown
    if (showCategoryDropdown && 
        !target.closest('[class*="categoryDropdown"]') && 
        !target.closest('[class*="periodDropdownMenu"]') &&
        !target.closest('[class*="periodDropdownItem"]')) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowCategoryDropdown(false);
        setIsClosingDropdown(false);
      }, 200);
    }
    
    // Fechar dropdown de subcategoria se clicar fora E não for um item do dropdown
    if (showSubcategoryDropdown && 
        !target.closest('[class*="subcategoryDropdown"]') && 
        !target.closest('[class*="periodDropdownMenu"]') &&
        !target.closest('[class*="periodDropdownItem"]')) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowSubcategoryDropdown(false);
        setIsClosingDropdown(false);
      }, 200);
    }
    
    // Fechar dropdown de período se clicar fora E não for um item do dropdown
    if (showPeriodDropdown && 
        !target.closest('[class*="periodDropdown"]') && 
        !target.closest('[class*="periodDropdownMenu"]') &&
        !target.closest('[class*="periodDropdownItem"]')) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowPeriodDropdown(false);
        setIsClosingDropdown(false);
      }, 200);
    }
    
    // Fechar date range picker se clicar fora E não for um item do dropdown
    if (showDateRangePicker && 
        !target.closest('[class*="periodDropdown"]') && 
        !target.closest('[class*="dateRangePicker"]')) {
      setIsClosingDropdown(true);
      setTimeout(() => {
        setShowDateRangePicker(false);
        setIsClosingDropdown(false);
      }, 200);
    }
    
    // Fechar resumo detalhado se clicar fora
    if (clickedSubcategory && 
        !target.closest('[class*="subcategorySummary"]') && 
        !target.closest('[class*="transactionTooltip"]')) {
      setClickedSubcategory(null);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showCategoryDropdown, showSubcategoryDropdown, showPeriodDropdown, showDateRangePicker, clickedSubcategory]);

const handleCategoryToggle = (category: string) => {
  // Mapeamento de subcategorias para suas categorias
  const categoryToSubcategories: { [key: string]: string[] } = {
    'Alimentação': ['Restaurantes', 'Supermercado'],
    'Contas': ['Aluguel'],
    'Lazer': ['Streaming', 'Academia']
  };
  
  if (category === 'Todas Categorias') {
    // Ativar todas categorias
    const allCategories = ['Alimentação', 'Contas', 'Lazer'];
    setActiveCategories(allCategories);
    // Ativar todas subcategorias
    const allSubcategories = ['Restaurantes', 'Supermercado', 'Streaming', 'Aluguel', 'Academia'];
    setActiveSubcategories(allSubcategories);
  } else {
    setActiveCategories(prev => {
      const newCategories = prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category];
      
      // Se desativou uma categoria, desativar suas subcategorias
      if (!newCategories.includes(category)) {
        const subcategoriesToDisable = categoryToSubcategories[category] || [];
        setActiveSubcategories(prevSubs => 
          prevSubs.filter(sub => !subcategoriesToDisable.includes(sub))
        );
      }
      
      // Se ativou uma categoria, ativar suas subcategorias
      if (newCategories.includes(category) && !prev.includes(category)) {
        const subcategoriesToEnable = categoryToSubcategories[category] || [];
        setActiveSubcategories(prevSubs => {
          const newSubs = [...prevSubs];
          subcategoriesToEnable.forEach(sub => {
            if (!newSubs.includes(sub)) {
              newSubs.push(sub);
            }
          });
          return newSubs;
        });
      }
      
      return newCategories;
    });
  }
};

  const handleSubcategoryToggle = (subcategory: string) => {
    // Mapeamento de subcategorias para suas categorias
    const subcategoryToCategory: { [key: string]: string } = {
      'Restaurantes': 'Alimentação',
      'Supermercado': 'Alimentação',
      'Streaming': 'Lazer',
      'Aluguel': 'Contas',
      'Academia': 'Lazer'
    };
    
    if (subcategory === 'Todas Subcategorias') {
      // Ativar apenas subcategorias das categorias ativas
      const allSubcategories = ['Restaurantes', 'Supermercado', 'Streaming', 'Aluguel', 'Academia'];
      const activeSubcategoriesFiltered = allSubcategories.filter(sub => 
        activeCategories.includes(subcategoryToCategory[sub])
      );
      setActiveSubcategories(activeSubcategoriesFiltered);
    } else {
      setActiveSubcategories(prev => {
        const newSubcategories = prev.includes(subcategory) 
          ? prev.filter(s => s !== subcategory)
          : [...prev, subcategory];
        
        // "Todas Subcategorias" sempre fica desativado se qualquer item individual estiver desativado
        return newSubcategories;
      });
    }
  };

const handleBankToggle = (bankId: string) => {
  setSelectedBanks(prev => {
    if (prev.includes(bankId)) {
      return prev.filter(id => id !== bankId);
    } else {
      return [...prev, bankId];
    }
  });
};

const handleBankStackToggle = () => {
  setIsBankStackOpen(prev => !prev);
};

// Mock data das contas bancárias do usuário
const userBankAccounts = [
  { id: 'bb-1', bank: 'Banco do Brasil', account: 'Conta Corrente', logo: '/bb.png', accountName: 'Conta 1', indicator: '776' },
  { id: 'bb-2', bank: 'Banco do Brasil', account: 'Poupança', logo: '/bb.png', accountName: 'Conta 2', indicator: '654' },
  { id: 'nubank-1', bank: 'Nubank', account: 'Conta Digital', logo: '/nubank.png', accountName: 'PF', indicator: 'PF1' },
  { id: 'nubank-2', bank: 'Nubank', account: 'Cartão de Crédito', logo: '/nubank.png', accountName: 'PJ', indicator: 'PJ' },
  { id: 'santander-1', bank: 'Santander', account: 'Conta Corrente', logo: '/santander.jpeg', accountName: 'Conta 3', indicator: '554' },
];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Se tiver parcelas e não for 1, desabilitar "Fixo"
    if (field === 'installments' && value && value !== '1') {
      setIsFixedExpense(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Transação criada:', { transactionType, isFixedExpense, ...formData });
    // Reset form
    setFormData({
      name: '',
      value: '',
      installments: '',
      bank: '',
      account: '',
      project: '',
      category: '',
      subcategory: '',
      date: new Date().toISOString().split('T')[0],
      fixedMonths: ''
    });
    setIsFixedExpense(false);
  };

  const hasFormData = formData.name || formData.value || formData.project || formData.category || formData.subcategory;
  const hasFormDataAndFormOpen = hasFormData && showTransactionForm && !isClosingForm;

  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [glowingCards, setGlowingCards] = useState<Set<number>>(new Set());

  const handleCardAnimationStart = (cardIndex: number) => {
    setActiveCard(cardIndex);
    // Limpar brilho anterior
    setGlowingCards(new Set());
    
    // Aplicar estilos diretamente via inline style
    setTimeout(() => {
      const cardElement = cardRefs.current[cardIndex];
      if (cardElement) {
        // Aplicar estilos inline para garantir que funcionem
        cardElement.style.setProperty('box-shadow', '0 0 8px rgba(139, 92, 246, 0.15), 0 0 20px rgba(139, 92, 246, 0.05)', 'important');
        cardElement.style.setProperty('transform', 'translateY(-2px) scale(1.01)', 'important');
        cardElement.style.setProperty('transition', 'all 0.3s ease', 'important');
        cardElement.style.setProperty('background', 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))', 'important');
        cardElement.style.setProperty('border', '1px solid rgba(139, 92, 246, 0.3)', 'important');
        
        // Forçar cores dos números
        const amountElements = cardElement.querySelectorAll('.amount, .change');
        amountElements.forEach(el => {
          (el as HTMLElement).style.setProperty('color', '#8b5cf6', 'important');
        });
      }
    }, 50);
  };

  const handleCardAnimationEnd = (cardIndex: number) => {
    setActiveCard(null);
    // Adicionar brilho após animação
    setGlowingCards(prev => new Set(prev).add(cardIndex));
    
    // Transição suave de volta ao estado original
    setTimeout(() => {
      const cardElement = cardRefs.current[cardIndex];
      if (cardElement) {
        // Aplicar transição suave para remover os estilos do card
        cardElement.style.setProperty('transition', 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
        
        // Adicionar transição mais lenta para o glow dos números
        const amountElements = cardElement.querySelectorAll('.amount, .change');
        amountElements.forEach(el => {
          (el as HTMLElement).style.setProperty('transition', 'color 1.5s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
        });
        
        // Primeiro: fade suave do card (mais rápido)
        setTimeout(() => {
          cardElement.style.setProperty('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.1)', 'important');
          cardElement.style.setProperty('transform', 'translateY(0) scale(1)', 'important');
          cardElement.style.setProperty('background', 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.8))', 'important');
          cardElement.style.setProperty('border', '1px solid rgba(59, 130, 246, 0.15)', 'important');
        }, 50);
        
        // Segundo: fade bem lento dos números (começa depois do card)
        setTimeout(() => {
          amountElements.forEach(el => {
            const element = el as HTMLElement;
            // Verificar se é positivo ou negativo para restaurar a cor correta
            if (element.classList.contains('positiveAmount')) {
              element.style.setProperty('color', '#10b981', 'important');
            } else if (element.classList.contains('negativeAmount')) {
              element.style.setProperty('color', '#ef4444', 'important');
            } else {
              element.style.setProperty('color', '#ffffff', 'important');
            }
          });
        }, 200); // Começa a transição dos números depois do card
        
        // Remover completamente os estilos inline após todas as transições
        setTimeout(() => {
          cardElement.style.removeProperty('box-shadow');
          cardElement.style.removeProperty('transform');
          cardElement.style.removeProperty('background');
          cardElement.style.removeProperty('border');
          cardElement.style.removeProperty('transition');
          
          amountElements.forEach(el => {
            const element = el as HTMLElement;
            element.style.removeProperty('color');
            element.style.removeProperty('transition');
          });
        }, 1800); // Espera a transição mais longa terminar (1.5s + 0.2s + 0.1s)
      }
    }, 100);
    
    // Remover brilho após 2 segundos
    setTimeout(() => {
      setGlowingCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardIndex);
        return newSet;
      });
    }, 2000);
  };

  const getMonthlyData = () => ({
    balance: { value: 26472, change: '+8,5%', positive: true },
    income: { value: 42150, change: '+12,3%', positive: true },
    expenses: { value: 15678, change: '+5,2%', positive: false },
    losses: { value: 3309, change: '-12,5%', positive: false },
    projection: { value: 28900, change: '-1,5%', positive: false }
  });

  const getYearlyData = () => ({
    balance: { value: 318864, change: '+15,2%', positive: true },
    income: { value: 505800, change: '+18,7%', positive: true },
    expenses: { value: 187200, change: '+8,9%', positive: false },
    losses: { value: 39708, change: '-3,2%', positive: false },
    projection: { value: 310500, change: '-2,8%', positive: false }
  });

// Mock data para o resumo detalhado
const getSummaryData = () => ({
  categories: {
    'Alimentação': {
      income: 0,
      expense: 3500,
      total: -3500,
      subcategories: {
        'Restaurantes': { 
          income: 0, 
          expense: 1500, 
          total: -1500,
          transactions: [
            { date: '15/01/2024', value: 450, bank: 'bb', account: '776', name: 'Jantar no Outback' },
            { date: '20/01/2024', value: 280, bank: 'nubank', account: 'PF1', name: 'Pizza com amigos' },
            { date: '25/01/2024', value: 770, bank: 'santander', account: '554', name: 'Aniversário' }
          ]
        },
        'Supermercado': { 
          income: 0, 
          expense: 2000, 
          total: -2000,
          transactions: [
            { date: '10/01/2024', value: 850, bank: 'bb', account: '776', name: 'Compras mês' },
            { date: '22/01/2024', value: 650, bank: 'nubank', account: 'PF1', name: 'Carrefour' },
            { date: '28/01/2024', value: 500, bank: 'bb', account: '654', name: 'Extra' }
          ]
        }
      }
    },
    'Contas': {
      income: 15000,
      expense: 8500,
      total: 6500,
      subcategories: {
        'Aluguel': { 
          income: 0, 
          expense: 5000, 
          total: -5000,
          transactions: [
            { date: '05/01/2024', value: 5000, bank: 'bb', account: '776', name: 'Aluguel Janeiro' }
          ]
        }
      }
    },
    'Lazer': {
      income: 0,
      expense: 800,
      total: -800,
      subcategories: {
        'Streaming': { 
          income: 0, 
          expense: 300, 
          total: -300,
          transactions: [
            { date: '01/01/2024', value: 50, bank: 'nubank', account: 'PF1', name: 'Netflix' },
            { date: '01/01/2024', value: 30, bank: 'nubank', account: 'PJ', name: 'Spotify' },
            { date: '05/01/2024', value: 70, bank: 'bb', account: '776', name: 'Amazon Prime' },
            { date: '10/01/2024', value: 150, bank: 'santander', account: '554', name: 'HBO Max' }
          ]
        },
        'Academia': { 
          income: 0, 
          expense: 500, 
          total: -500,
          transactions: [
            { date: '08/01/2024', value: 500, bank: 'nubank', account: 'PF1', name: 'Mensalidade Academia' }
          ]
        }
      }
    }
  },
  total: {
    income: 15000,
    expense: 12800,
    balance: 2200
  }
});

  const currentData = periodType === 'monthly' ? getMonthlyData() : getYearlyData();

  // Renderizar conteúdo baseado na tela atual
  if (currentScreen !== 'home') {
    const titles = {
      history: 'Histórico de Transações',
      comparison: 'Comparação',
      reports: 'Relatórios',
        creation: 'Criação',
      achievements: 'Conquistas',
      settings: 'Configurações'
    };
    
    return (
      <div className={styles.mainContent}>
        <div className={styles.fullScreenContent}>
          <h1>{titles[currentScreen]}</h1>
          <p>Conteúdo da tela {titles[currentScreen]} em desenvolvimento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mainContent}>
      <header className={styles.header}>
        <div className={styles.dateInfo}>
          <h1>{formatDateTime(currentDateTime)}</h1>
        </div>
        <div className={styles.userInfo}>
          <button ref={registerButtonRef(4)} className={styles.fullscreenBtn} onClick={toggleFullscreen} title="Tela Cheia">
            <Maximize2 size={20} />
          </button>
          <div className={styles.userAvatar}>U</div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>Usuário</div>
            <div className={styles.userRole}>Premium</div>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.leftSection}>
          <div className={styles.dashboardHeader}>
            <h2>Dashboard Financeiro</h2>
            <div className={styles.headerWithBanks}>
              <div className={styles.headerFilters}>
                <div className={styles.actionButtons}>
                  <div className={styles.bankSection}>
                    <div className={`${styles.bankStack} ${isBankStackOpen ? styles.open : ''}`} onClick={isBankStackOpen ? undefined : () => setIsBankStackOpen(true)}>
                      {userBankAccounts.map((account, index) => (
                        <div 
                          key={account.id}
                          className={`${styles.bankStackItem} ${selectedBanks.includes(account.id) ? styles.disabled : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBankToggle(account.id);
                            if (!isBankStackOpen) {
                              setIsBankStackOpen(true);
                            }
                          }}
                          title={`${account.bank} - ${account.account}`}
                          style={{ zIndex: userBankAccounts.length - index }}
                        >
                          <img src={account.logo} alt={account.bank} className={styles.bankStackLogo} />
                          {isBankStackOpen && (
                            <div className={styles.bankIndicator}>{account.indicator}</div>
                          )}
                        </div>
                      ))}
                      {isBankStackOpen && (
                        <div 
                          className={styles.bankStackClose}
                          onClick={handleBankStackToggle}
                          title="Fechar"
                        >
                          ×
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.periodDropdown}>
                    <button 
                      className={styles.periodDropdownBtn}
                      onClick={handleDropdownToggle}
                    >
                      {selectedPeriod}
                    </button>
                    {showPeriodDropdown && periodType !== 'custom' && (
                      <div className={`${styles.periodDropdownMenu} ${isClosingDropdown ? styles.closing : ''}`}>
                        {periodType === 'monthly' ? (
                          <>
                            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map(month => (
                              <div 
                                key={month}
                                className={styles.periodDropdownItem}
                                onClick={() => {
                                  setSelectedPeriod(`${month} ${new Date().getFullYear()}`);
                                  setShowPeriodDropdown(false);
                                }}
                              >
                                {month}
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            {[2024, 2025, 2026, 2027, 2028].map(year => (
                              <div 
                                key={year}
                                className={styles.periodDropdownItem}
                                onClick={() => {
                                  setSelectedPeriod(year.toString());
                                  setShowPeriodDropdown(false);
                                }}
                              >
                                {year}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                    {showDateRangePicker && periodType === 'custom' && (
                      <div className={`${styles.dateRangePicker} ${isClosingDropdown ? styles.closing : ''}`}>
                        <div className={styles.dateRangeInputs}>
                          <div className={styles.dateInputGroup}>
                            <label>Data Inicial</label>
                            <input 
                              type="date" 
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                            />
                          </div>
                          <div className={styles.dateInputGroup}>
                            <label>Data Final</label>
                            <input 
                              type="date" 
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                            />
                          </div>
                          <div className={styles.dateInputGroup}>
                            <button 
                              className={styles.maxDateBtn}
                              onClick={handleMaxDateRange}
                              title="Selecionar período máximo"
                            >
                              Máximo
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.categoryDropdown}>
                    <button 
                      className={styles.periodDropdownBtn}
                      onClick={handleCategoryDropdownToggle}
                    >
                      {activeCategories.length === 0 ? 'Todas Categorias' : 
   activeCategories.length === 3 ? 'Todas Categorias' : 
   `${activeCategories.length} categorias`}
                    </button>
                    {showCategoryDropdown && (
                      <div className={`${styles.periodDropdownMenu} ${isClosingDropdown ? styles.closing : ''}`}>
                        {['Todas Categorias', 'Alimentação', 'Contas', 'Lazer'].map(category => {
                          const isAllCategories = category === 'Todas Categorias';
                          const allCategories = ['Alimentação', 'Contas', 'Lazer'];
                          const allActive = allCategories.every(cat => activeCategories.includes(cat));
                          const isActive = isAllCategories ? allActive : activeCategories.includes(category);
                          
                          return (
                            <div 
                              key={category}
                              className={`${styles.periodDropdownItem} ${!isActive ? styles.inactive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCategoryToggle(category);
                              }}
                            >
                              {category}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className={styles.subcategoryDropdown}>
                    <button 
                      className={styles.periodDropdownBtn}
                      onClick={handleSubcategoryDropdownToggle}
                    >
                      {activeSubcategories.length === 0 ? 'Todas Subcategorias' : 
   activeSubcategories.length === 5 ? 'Todas Subcategorias' : 
   `${activeSubcategories.length} subcategorias`}
                    </button>
                    {showSubcategoryDropdown && (
                      <div className={`${styles.periodDropdownMenu} ${isClosingDropdown ? styles.closing : ''}`}>
                        {['Todas Subcategorias', 'Restaurantes', 'Supermercado', 'Streaming', 'Aluguel', 'Academia'].map(subcategory => {
                          const isAllSubcategories = subcategory === 'Todas Subcategorias';
                          const subcategoryToCategory: { [key: string]: string } = {
                            'Restaurantes': 'Alimentação',
                            'Supermercado': 'Alimentação',
                            'Streaming': 'Lazer',
                            'Aluguel': 'Contas',
                            'Academia': 'Lazer'
                          };
                          
                          // Verificar se a categoria desta subcategoria está ativa
                          const parentCategory = subcategoryToCategory[subcategory];
                          const isParentCategoryActive = parentCategory ? activeCategories.includes(parentCategory) : false;
                          
                          // Só mostrar subcategorias se sua categoria estiver ativa
                          if (!isAllSubcategories && !isParentCategoryActive) {
                            return null;
                          }
                          
                          // Filtrar subcategorias ativas baseadas nas categorias ativas
                          const allSubcategories = ['Restaurantes', 'Supermercado', 'Streaming', 'Aluguel', 'Academia'];
                          const availableSubcategories = allSubcategories.filter(sub => {
                            const category = subcategoryToCategory[sub];
                            return activeCategories.includes(category);
                          });
                          
                          const allActive = availableSubcategories.every(sub => activeSubcategories.includes(sub));
                          const isActive = isAllSubcategories ? allActive : activeSubcategories.includes(subcategory);
                          
                          return (
                            <div 
                              key={subcategory}
                              className={`${styles.periodDropdownItem} ${!isActive ? styles.inactive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubcategoryToggle(subcategory);
                              }}
                            >
                              {subcategory}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button ref={registerButtonRef(0)} className={`${styles.periodBtn} ${periodType === 'monthly' ? styles.selected : ''}`} onClick={() => handlePeriodTypeChange('monthly')}>
                    Mensal
                  </button>
                  <button ref={registerButtonRef(1)} className={`${styles.periodBtn} ${periodType === 'yearly' ? styles.selected : ''}`} onClick={() => handlePeriodTypeChange('yearly')}>
                    Anual
                  </button>
                  <button 
                    ref={registerButtonRef(2)}
                    className={`${styles.periodBtn} ${periodType === 'custom' ? styles.selected : ''}`}
                    onClick={() => handlePeriodTypeChange('custom')}
                  >
                    <Calendar size={16} />
                  </button>
                  <button 
                    ref={registerButtonRef(3)}
                    className={styles.createTransactionBtn}
                    onClick={handleToggleForm}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {/* Sistema de Tags */}
                <div className={styles.tagsRow}>
                  <div className={styles.tagSmall} onClick={handleSummaryToggle}>
                    <span className={styles.tagText}><strong>TUDO</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.projectionCards}>
            <div ref={registerCardRef(0)} className={`${styles.balanceCard} ${activeCard === 0 ? styles.cardAnimating : ''}`}>
              <h3>Receita {periodType === 'monthly' ? 'Mensal' : 'Anual'}</h3>
              <div className={`${styles.amount} ${styles.positiveAmount}`}>
                <AnimatedNumber 
                  value={currentData.income.value} 
                  prefix={`${currencySymbol} `}
                  decimals={0}
                  duration={1.5}
                  className={`${styles.positiveAmount} ${glowingCards.has(0) ? styles.positiveGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(0)}
                  onAnimationEnd={() => handleCardAnimationEnd(0)}
                />
              </div>
              <div className={`${styles.change} ${currentData.income.positive ? styles.positive : styles.negative}`}>
                <AnimatedPercentage 
                  value={currentData.income.change}
                  duration={1.5}
                  className={`${glowingCards.has(0) ? styles.positiveGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(0)}
                  onAnimationEnd={() => handleCardAnimationEnd(0)}
                />
              </div>
            </div>
            <div ref={registerCardRef(1)} className={`${styles.balanceCard} ${activeCard === 1 ? styles.cardAnimating : ''}`}>
              <h3>Perdas Totais</h3>
              <div className={`${styles.amount} ${styles.negativeAmount}`}>
                <AnimatedNumber 
                  value={currentData.losses.value} 
                  prefix={`${currencySymbol} `}
                  decimals={0}
                  duration={1.5}
                  className={`${styles.negativeAmount} ${glowingCards.has(1) ? styles.negativeGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(1)}
                  onAnimationEnd={() => handleCardAnimationEnd(1)}
                />
              </div>
              <div className={`${styles.change} ${styles.negative}`}>
                <AnimatedPercentage 
                  value={currentData.losses.change}
                  duration={1.5}
                  className={`${glowingCards.has(1) ? styles.negativeGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(1)}
                  onAnimationEnd={() => handleCardAnimationEnd(1)}
                />
              </div>
            </div>
            <div ref={registerCardRef(2)} className={`${styles.balanceCard} ${activeCard === 2 ? styles.cardAnimating : ''}`}>
              <h3>Projeção de Perdas</h3>
              <div className={`${styles.amount} ${styles.negativeAmount}`}>
                <AnimatedNumber 
                  value={currentData.projection.value} 
                  prefix={`${currencySymbol} `}
                  decimals={0}
                  duration={1.5}
                  className={`${styles.negativeAmount} ${glowingCards.has(2) ? styles.negativeGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(2)}
                  onAnimationEnd={() => handleCardAnimationEnd(2)}
                />
              </div>
              <div className={`${styles.change} ${styles.negative}`}>
                <AnimatedPercentage 
                  value={currentData.projection.change}
                  duration={1.5}
                  className={`${glowingCards.has(2) ? styles.negativeGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(2)}
                  onAnimationEnd={() => handleCardAnimationEnd(2)}
                />
              </div>
            </div>
          </div>

          <div className={styles.balanceCards}>
            <div ref={registerCardRef(3)} className={`${styles.balanceCard} ${activeCard === 3 ? styles.cardAnimating : ''}`}>
              <h3>Saldo</h3>
              <div className={`${styles.amount} ${currentData.balance.positive ? styles.positiveAmount : styles.negativeAmount}`}>
                <AnimatedNumber 
                  value={currentData.balance.value} 
                  prefix={`${currencySymbol} `}
                  decimals={0}
                  duration={1.5}
                  className={`${currentData.balance.positive ? styles.positiveAmount : styles.negativeAmount} ${glowingCards.has(3) ? (currentData.balance.positive ? styles.positiveGlow : styles.negativeGlow) : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(3)}
                  onAnimationEnd={() => handleCardAnimationEnd(3)}
                />
              </div>
              <div className={`${styles.change} ${currentData.balance.positive ? styles.positive : styles.negative}`}>
                <AnimatedPercentage 
                  value={currentData.balance.change}
                  duration={1.5}
                  className={`${glowingCards.has(3) ? (currentData.balance.positive ? styles.positiveGlow : styles.negativeGlow) : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(3)}
                  onAnimationEnd={() => handleCardAnimationEnd(3)}
                />
              </div>
            </div>
            <div ref={registerCardRef(4)} className={`${styles.balanceCard} ${activeCard === 4 ? styles.cardAnimating : ''}`}>
              <h3>Despesas</h3>
              <div className={`${styles.amount} ${styles.negativeAmount}`}>
                <AnimatedNumber 
                  value={currentData.expenses.value} 
                  prefix={`${currencySymbol} `}
                  decimals={0}
                  duration={1.5}
                  className={`${styles.negativeAmount} ${glowingCards.has(4) ? styles.negativeGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(4)}
                  onAnimationEnd={() => handleCardAnimationEnd(4)}
                />
              </div>
              <div className={`${styles.change} ${styles.negative}`}>
                <AnimatedPercentage 
                  value={currentData.expenses.change}
                  duration={1.5}
                  className={`${glowingCards.has(4) ? styles.negativeGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(4)}
                  onAnimationEnd={() => handleCardAnimationEnd(4)}
                />
              </div>
            </div>
            <div ref={registerCardRef(5)} className={`${styles.balanceCard} ${activeCard === 5 ? styles.cardAnimating : ''}`}>
              <h3>Meta de Economia</h3>
              <div className={`${styles.amount} ${styles.positiveAmount}`}>
                <AnimatedNumber 
                  value={8500} 
                  prefix={`${currencySymbol} `}
                  decimals={0}
                  duration={1.5}
                  className={`${styles.positiveAmount} ${glowingCards.has(5) ? styles.positiveGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(5)}
                  onAnimationEnd={() => handleCardAnimationEnd(5)}
                />
              </div>
              <div className={`${styles.change} ${styles.positive}`}>
                <AnimatedPercentage 
                  value="+15,3%"
                  duration={1.5}
                  className={`${glowingCards.has(5) ? styles.positiveGlow : ''}`}
                  onAnimationStart={() => handleCardAnimationStart(5)}
                  onAnimationEnd={() => handleCardAnimationEnd(5)}
                />
              </div>
            </div>
          </div>

          <Statistics className={styles.chartSection} />

          <div className={styles.transactionHistory}>
            <h2>Histórico de Transações</h2>
            <div className={styles.transactionList}>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Salário</div>
                  <div className={styles.transactionDate}>01/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 5.000,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Supermercado</div>
                  <div className={styles.transactionDate}>02/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 450,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Freelance</div>
                  <div className={styles.transactionDate}>03/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 1.200,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Aluguel</div>
                  <div className={styles.transactionDate}>05/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 2.500,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Restaurante</div>
                  <div className={styles.transactionDate}>06/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 180,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Investimento</div>
                  <div className={styles.transactionDate}>07/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 800,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Contas de Luz</div>
                  <div className={styles.transactionDate}>08/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 220,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Internet</div>
                  <div className={styles.transactionDate}>09/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 120,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Transporte</div>
                  <div className={styles.transactionDate}>10/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 85,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Presente</div>
                  <div className={styles.transactionDate}>11/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 350,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Bônus</div>
                  <div className={styles.transactionDate}>12/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 1.500,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Farmácia</div>
                  <div className={styles.transactionDate}>13/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 95,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Academia</div>
                  <div className={styles.transactionDate}>14/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 150,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Streaming</div>
                  <div className={styles.transactionDate}>15/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 50,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Consultoria</div>
                  <div className={styles.transactionDate}>16/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 2.000,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Combustível</div>
                  <div className={styles.transactionDate}>17/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 280,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Roupas</div>
                  <div className={styles.transactionDate}>18/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 420,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Livros</div>
                  <div className={styles.transactionDate}>19/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 130,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Café</div>
                  <div className={styles.transactionDate}>20/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 25,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Taxi</div>
                  <div className={styles.transactionDate}>21/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 65,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Venda</div>
                  <div className={styles.transactionDate}>22/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 750,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Supermercado</div>
                  <div className={styles.transactionDate}>23/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 320,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Cinema</div>
                  <div className={styles.transactionDate}>24/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 80,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Projeto</div>
                  <div className={styles.transactionDate}>25/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 3.000,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Telefone</div>
                  <div className={styles.transactionDate}>26/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 90,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Mercado</div>
                  <div className={styles.transactionDate}>27/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 580,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Restaurante</div>
                  <div className={styles.transactionDate}>28/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 220,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Dividendos</div>
                  <div className={styles.transactionDate}>29/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 450,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Estacionamento</div>
                  <div className={styles.transactionDate}>30/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.expense}`}>-{currencySymbol} 40,00</div>
              </div>
              <div className={styles.transactionItem}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>Salário</div>
                  <div className={styles.transactionDate}>31/01/2024</div>
                </div>
                <div className={`${styles.transactionAmount} ${styles.income}`}>+{currencySymbol} 5.000,00</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.rightSection}>
          {showSummary && (
            <div className={`${styles.summaryPanel} ${isClosingSummary ? styles.closing : ''}`}>
              <div className={styles.summaryPanelHeader}>
                <h2>Resumo Detalhado</h2>
                <button 
                  className={styles.summaryCloseBtn}
                  onClick={handleSummaryToggle}
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryTotal}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Entradas</span>
                    <span className={`${styles.summaryValue} ${styles.income}`}>+{currencySymbol} {getSummaryData().total.income.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Saídas</span>
                    <span className={`${styles.summaryValue} ${styles.expense}`}>-{currencySymbol} {getSummaryData().total.expense.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Saldo</span>
                    <span className={`${styles.summaryValue} ${getSummaryData().total.balance >= 0 ? styles.income : styles.expense}`}>
                      {getSummaryData().total.balance >= 0 ? '+' : '-'}{currencySymbol} {Math.abs(getSummaryData().total.balance).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
                
                <div className={styles.categoriesBreakdown}>
                  <h3>Categorias</h3>
                  {Object.entries(getSummaryData().categories).map(([category, data]) => (
                    <div key={category} className={styles.categorySummary}>
                      <div className={styles.categoryHeader}>
                        <h4>{category}</h4>
                        <div className={styles.categoryTotals}>
                          {data.income > 0 && (
                            <span className={`${styles.categoryValue} ${styles.income}`}>+{currencySymbol} {data.income.toLocaleString('pt-BR')}</span>
                          )}
                          {data.expense > 0 && (
                            <span className={`${styles.categoryValue} ${styles.expense}`}>-{currencySymbol} {data.expense.toLocaleString('pt-BR')}</span>
                          )}
                          {data.income > 0 && data.expense > 0 && (
                            <span className={`${styles.categoryValue} ${styles.result}`}>
                              {data.total >= 0 ? '+' : '-'}{currencySymbol} {Math.abs(data.total).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className={styles.subcategoriesList}>
                        {Object.entries(data.subcategories).map(([subcategory, subData]) => (
                          <div 
                            key={subcategory} 
                            className={styles.subcategorySummary}
                            onClick={() => setClickedSubcategory(clickedSubcategory === subcategory ? null : subcategory)}
                          >
                            <span className={styles.subcategoryName}>{subcategory}</span>
                            <div className={styles.subcategoryTotals}>
                              {subData.income > 0 && (
                                <span className={`${styles.subcategoryValue} ${styles.income}`}>+{currencySymbol} {subData.income.toLocaleString('pt-BR')}</span>
                              )}
                              {subData.expense > 0 && (
                                <span className={`${styles.subcategoryValue} ${styles.expense}`}>-{currencySymbol} {subData.expense.toLocaleString('pt-BR')}</span>
                              )}
                              {subData.income > 0 && subData.expense > 0 && (
                                <span className={`${styles.subcategoryValue} ${styles.result}`}>
                                  {subData.total >= 0 ? '+' : '-'}{currencySymbol} {Math.abs(subData.total).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </div>
                            
                            {clickedSubcategory === subcategory && subData.transactions && (
                              <div className={styles.transactionTooltip}>
                                <h4>
                                  Transações - {subcategory}
                                  <button 
                                    className={styles.tooltipCloseBtn}
                                    onClick={() => setClickedSubcategory(null)}
                                    title="Fechar"
                                  >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <path d="M18 6L6 18M6 6l12 12"/>
                                    </svg>
                                  </button>
                                </h4>
                                <div className={styles.tooltipTransactions}>
                                  {subData.transactions.map((transaction, index) => (
                                    <div key={index} className={styles.tooltipTransaction}>
                                      <div className={styles.transactionInfo}>
                                        <div className={styles.transactionHeader}>
                                          <span className={styles.transactionName}>{transaction.name}</span>
                                          <span className={styles.transactionDate}>{transaction.date}</span>
                                        </div>
                                        <div className={styles.transactionDetails}>
                                          <div className={styles.bankInfo}>
                                            <img src={`/bb.png`} alt="bb" className={styles.bankLogo} />
                                            <span className={styles.bankAccount}>{transaction.account}</span>
                                          </div>
                                          <span className={`${styles.transactionAmount} ${styles.expense}`}>
                                            -{currencySymbol} {transaction.value.toLocaleString('pt-BR')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {showTransactionForm && (
            <div className={`${styles.transactionCreator} ${isClosingForm ? styles.closing : ''}`}>
              <h2>Criar Transação</h2>
              <form className={styles.transactionForm} onSubmit={handleSubmit}>
                <div className={styles.typeSelector}>
                  <button 
                    type="button" 
                    className={`${styles.typeBtn} ${styles.income} ${transactionType === 'income' ? styles.selected : ''}`}
                    onClick={() => setTransactionType('income')}
                  >
                    <TrendingUp size={20} />
                  </button>
                  <button 
                    type="button" 
                    className={`${styles.typeBtn} ${styles.expense} ${transactionType === 'expense' ? styles.selected : ''}`}
                    onClick={() => setTransactionType('expense')}
                  >
                    <TrendingDown size={20} />
                  </button>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <input 
                      type="text" 
                      placeholder="Nome da transação" 
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <input 
                      type="date" 
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <input 
                      type="number" 
                      placeholder="Valor total" 
                      value={formData.value}
                      onChange={(e) => handleInputChange('value', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <input 
                      type="number" 
                      placeholder="Parcelas" 
                      value={formData.installments}
                      onChange={(e) => handleInputChange('installments', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <select 
                      value={formData.bank}
                      onChange={(e) => handleInputChange('bank', e.target.value)}
                    >
                      <option value="">Banco</option>
                      <option value="Banco do Brasil">Banco do Brasil</option>
                      <option value="Caixa">Caixa</option>
                      <option value="Itaú">Itaú</option>
                      <option value="Bradesco">Bradesco</option>
                      <option value="Santander">Santander</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <input 
                      type="text" 
                      placeholder="Conta" 
                      value={formData.account}
                      onChange={(e) => handleInputChange('account', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <select 
                    value={formData.project}
                    onChange={(e) => handleInputChange('project', e.target.value)}
                  >
                    <option value="">Selecione um projeto</option>
                    <option value="Pessoal">Pessoal</option>
                    <option value="Trabalho">Trabalho</option>
                    <option value="Investimentos">Investimentos</option>
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <select 
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                    >
                      <option value="">Categoria</option>
                      <option value="Alimentação">Alimentação</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Entretenimento">Entretenimento</option>
                      <option value="Contas">Contas</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Educação">Educação</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <select 
                      value={formData.subcategory}
                      onChange={(e) => handleInputChange('subcategory', e.target.value)}
                    >
                      <option value="">Subcategoria</option>
                      <option value="Restaurante">Restaurante</option>
                      <option value="Supermercado">Supermercado</option>
                      <option value="Combustível">Combustível</option>
                      <option value="Streaming">Streaming</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <button 
                    type="button"
                    className={`${styles.fixedBtn} ${isFixedExpense ? styles.selected : ''}`}
                    onClick={() => setIsFixedExpense(!isFixedExpense)}
                    disabled={!!(formData.installments && formData.installments !== '1')}
                  >
                    <strong>Fixo</strong>
                  </button>
                  {isFixedExpense && (
                    <div className={styles.formGroup}>
                      <input 
                        type="number" 
                        placeholder="Meses" 
                        value={formData.fixedMonths}
                        onChange={(e) => handleInputChange('fixedMonths', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className={`${styles.submitBtn} ${transactionType === 'income' ? styles.incomeBtn : styles.expenseBtn}`}>Criar Transação</button>
              </form>
            </div>
          )}

          {hasFormDataAndFormOpen && (
            <div className={`${styles.transactionPreview} ${isClosingForm ? styles.closing : ''}`}>
              <div className={`${styles.transactionItem} ${transactionType === 'income' ? styles.previewIncome : styles.previewExpense}`}>
                <div className={styles.transactionInfo}>
                  <div className={styles.transactionName}>
                    {formData.name || 'Nome da transação'}
                  </div>
                  <div className={styles.transactionDetails}>
                    {formData.project && (
                      <span className={styles.transactionProject}>{formData.project}</span>
                    )}
                    {formData.category && (
                      <span className={styles.transactionCategory}>{formData.category}</span>
                    )}
                    {formData.subcategory && (
                      <span className={styles.transactionSubcategory}>{formData.subcategory}</span>
                    )}
                  </div>
                </div>
                <div className={styles.transactionRight}>
                  <div className={`${styles.transactionAmount} ${transactionType === 'income' ? styles.income : styles.expense}`}>
                    {transactionType === 'income' ? '+' : '-'}{formData.value ? `${currencySymbol} ${formData.value}` : `${currencySymbol} 0,00`}
                  </div>
                  <div className={styles.transactionDate}>
                    {formData.date || new Date().toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Conteúdo adicional para testar scroll */}
        <div className={styles.additionalContent}>
        </div>
      </div>
    </div>
  );
};

export default MainContent;
