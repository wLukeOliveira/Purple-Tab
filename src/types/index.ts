export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  createdAt: string;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  debts: number;
  assets: number;
}

export interface AppState {
  transactions: Transaction[];
  summary: FinancialSummary;
  currentSection: 'dashboard' | 'transactions' | 'reports' | 'settings';
}
