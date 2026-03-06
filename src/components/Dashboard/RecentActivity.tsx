import React from 'react';
import { ArrowUpRight, ArrowDownRight, MoreVertical } from 'lucide-react';
import type { Transaction } from '../../types';
import styles from './RecentActivity.module.css';

interface RecentActivityProps {
  transactions: Transaction[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ transactions }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className={styles.recentActivity}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Atividades Recentes</h3>
        <button className={styles.moreBtn}>
          <MoreVertical size={18} />
        </button>
      </div>
      
      <div className={styles.transactionsList}>
        {recentTransactions.map((transaction) => (
          <div key={transaction.id} className={styles.transactionItem}>
            <div className={styles.transactionIcon}>
              {transaction.type === 'income' ? (
                <div className={`${styles.iconWrapper} ${styles.income}`}>
                  <ArrowUpRight size={16} />
                </div>
              ) : (
                <div className={`${styles.iconWrapper} ${styles.expense}`}>
                  <ArrowDownRight size={16} />
                </div>
              )}
            </div>
            
            <div className={styles.transactionDetails}>
              <div className={styles.transactionInfo}>
                <span className={styles.transactionDescription}>
                  {transaction.description}
                </span>
                <span className={styles.transactionCategory}>
                  {transaction.category}
                </span>
              </div>
              <div className={styles.transactionMeta}>
                <span className={styles.transactionDate}>
                  {formatDate(transaction.date)}
                </span>
                <span className={`${styles.transactionAmount} ${
                  transaction.type === 'income' ? styles.income : styles.expense
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {recentTransactions.length === 0 && (
        <div className={styles.emptyState}>
          <span>Nenhuma transação encontrada</span>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
