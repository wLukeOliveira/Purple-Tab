import React from 'react';
import { Plus, History } from 'lucide-react';
import BalanceCard from './BalanceCard';
import RecentActivity from './RecentActivity';
import SummaryCards from './SummaryCards';
import type { Transaction, FinancialSummary } from '../../types';
import styles from './Dashboard.module.css';

interface DashboardProps {
  transactions: Transaction[];
  summary: FinancialSummary;
  onNewTransaction: () => void;
  onViewHistory: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  summary, 
  onNewTransaction, 
  onViewHistory 
}) => {
  return (
    <div className={styles.dashboard}>
      <div className={styles.mainContent}>
        <div className={styles.topSection}>
          <BalanceCard
            totalBalance={summary.totalBalance}
            income={summary.totalIncome}
            expense={summary.totalExpense}
            percentageChange={15.3}
          />
          
          <div className={styles.actionButtons}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onNewTransaction}>
              <Plus size={20} />
              <span>Nova Transação</span>
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onViewHistory}>
              <History size={20} />
              <span>Histórico Completo</span>
            </button>
          </div>
        </div>
        
        <div className={styles.contentSection}>
          <RecentActivity transactions={transactions} />
        </div>
      </div>
      
      <div className={styles.sidebarContent}>
        <SummaryCards
          debts={summary.debts}
          assets={summary.assets}
          evolution={15.7}
        />
      </div>
    </div>
  );
};

export default Dashboard;
