import React from 'react';
import { TrendingDown, TrendingUp, PieChart } from 'lucide-react';
import styles from './SummaryCards.module.css';

interface SummaryCardsProps {
  debts: number;
  assets: number;
  evolution: number;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ debts, assets, evolution }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const cards = [
    {
      title: 'Dívidas',
      value: debts,
      icon: TrendingDown,
      color: 'red',
      trend: -12.5
    },
    {
      title: 'Ativos',
      value: assets,
      icon: TrendingUp,
      color: 'green',
      trend: 8.3
    },
    {
      title: 'Evolução',
      value: evolution,
      icon: PieChart,
      color: 'blue',
      trend: 15.7
    }
  ];

  return (
    <div className={styles.summaryCards}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        const isPositive = card.trend >= 0;
        
        return (
          <div key={index} className={`${styles.card} ${styles[card.color]}`}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Icon size={20} />
              </div>
              <div className={`${styles.trend} ${isPositive ? styles.positive : styles.negative}`}>
                <span>{isPositive ? '+' : ''}{card.trend}%</span>
              </div>
            </div>
            
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>{card.title}</div>
              <div className={styles.cardValue}>
                {card.title === 'Evolução' 
                  ? `${card.value}%` 
                  : formatCurrency(card.value)
                }
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryCards;
