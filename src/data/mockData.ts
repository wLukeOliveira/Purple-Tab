import type { Transaction, FinancialSummary } from '../types';

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    description: 'Salário Mensal',
    amount: 8500,
    type: 'income',
    category: 'Salário',
    date: '2024-01-05',
    createdAt: '2024-01-05T10:00:00Z'
  },
  {
    id: '2',
    description: 'Aluguel Apartamento',
    amount: 2500,
    type: 'expense',
    category: 'Moradia',
    date: '2024-01-03',
    createdAt: '2024-01-03T14:30:00Z'
  },
  {
    id: '3',
    description: 'Supermercado',
    amount: 450,
    type: 'expense',
    category: 'Alimentação',
    date: '2024-01-07',
    createdAt: '2024-01-07T18:20:00Z'
  },
  {
    id: '4',
    description: 'Freelance - Projeto Web',
    amount: 3200,
    type: 'income',
    category: 'Freelance',
    date: '2024-01-10',
    createdAt: '2024-01-10T16:45:00Z'
  },
  {
    id: '5',
    description: 'Internet e Telefone',
    amount: 150,
    type: 'expense',
    category: 'Serviços',
    date: '2024-01-02',
    createdAt: '2024-01-02T09:15:00Z'
  },
  {
    id: '6',
    description: 'Restaurante',
    amount: 120,
    type: 'expense',
    category: 'Alimentação',
    date: '2024-01-08',
    createdAt: '2024-01-08T20:00:00Z'
  },
  {
    id: '7',
    description: 'Investimento - Renda Fixa',
    amount: 500,
    type: 'income',
    category: 'Investimentos',
    date: '2024-01-15',
    createdAt: '2024-01-15T11:30:00Z'
  },
  {
    id: '8',
    description: 'Academia',
    amount: 89,
    type: 'expense',
    category: 'Saúde',
    date: '2024-01-01',
    createdAt: '2024-01-01T07:00:00Z'
  }
];

export const mockSummary: FinancialSummary = {
  totalBalance: 8891,
  totalIncome: 12200,
  totalExpense: 3309,
  debts: 15000,
  assets: 23891
};
