import React from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import styles from './BalanceCard.module.css';

interface BalanceCardProps {
  totalBalance: number;
  income: number;
  expense: number;
  percentageChange: number;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ 
  totalBalance, 
  income, 
  expense, 
  percentageChange 
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const isPositive = percentageChange >= 0;

  return (
    <div className={styles.balanceCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <DollarSign size={24} />
          <span>Saldo Total</span>
        </div>
        <div className={`${styles.trendIndicator} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{Math.abs(percentageChange)}%</span>
        </div>
      </div>
      
      <div className={styles.balanceAmount}>
        {formatCurrency(totalBalance)}
      </div>
      
      <div className={styles.balanceDetails}>
        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>Receitas</div>
          <div className={`${styles.detailValue} ${styles.income}`}>
            +{formatCurrency(income)}
          </div>
        </div>
        <div className={styles.detailItem}>
          <div className={styles.detailLabel}>Despesas</div>
          <div className={`${styles.detailValue} ${styles.expense}`}>
            -{formatCurrency(expense)}
          </div>
        </div>
      </div>
      
      <div className={styles.cardFooter}>
        <div className={styles.periodInfo}>
          <span className={styles.periodText}>Últimos 30 dias</span>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
