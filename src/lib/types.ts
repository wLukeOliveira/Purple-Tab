export type EntryType = 'income' | 'expense'
export type Screen = 'home' | 'history' | 'comparison' | 'reports' | 'creation' | 'achievements' | 'settings' | 'investments' | 'bills' | 'loans' | 'patrimony' | 'cards'
export type PaymentMethod = 'other' | 'debit' | 'credit' | 'pix' | 'cash' | 'bank_slip'
export interface CreditCard { id: string; name: string; institution: string; lastFour: string; currency: string; icon: string; limitCents: number; closingDay: number; dueDay: number; dueMonthOffset: number; closingDayRule: 'current' | 'next'; accountId: string; archived: boolean }
export interface CardPurchase { id: string; cardId: string; description: string; amountCents: number; purchaseDate: string; count: number; projectId: string; categoryId: string; subcategoryId: string | null; notes: string; firstMonth: string; canceled: boolean }
export interface CardStatement { id: string; cardId: string; month: string; closingDate: string; dueDate: string }
export interface Project { id: string; name: string; color: string; icon?: string; archived: boolean; createdAt: string }
export interface Account { id: string; name: string; institution: string; currency?: string; icon?: string; type: 'checking' | 'savings' | 'cash' | 'investment'; initialBalanceCents: number; initialDate: string; archived: boolean }
export interface Category { id: string; name: string; type: EntryType; parentId: string | null; archived: boolean }
export interface Transaction {
  paymentMethod?: PaymentMethod; creditCardId?: string; cardPurchaseId?: string; statementId?: string;
  billId?: string; paymentId?: string; loanId?: string; economicCents?: number;
  id: string; description: string; type: EntryType; amountCents: number; accountId: string; projectId: string;
  categoryId: string; subcategoryId: string | null; dueDate: string; paidDate: string | null;
  status: 'pending' | 'settled'; notes: string; seriesId: string | null; occurrenceIndex: number | null;
  createdAt: string; updatedAt: string;
}
export interface TransactionInput {
  paymentMethod?: PaymentMethod;
  id?: string; description: string; type: EntryType; amountCents: number; accountId: string; projectId: string;
  categoryId: string; subcategoryId?: string | null; dueDate: string; paidDate?: string | null;
  status: 'pending' | 'settled'; notes?: string; seriesMode?: 'single' | 'installments' | 'recurring';
  count?: number; scope?: 'one' | 'future';
}
export interface Transfer { id: string; fromAccountId: string; toAccountId: string; amountCents: number; receivedCents?: number; date: string; notes: string }
export interface Goal { id: string; name: string; projectId: string | null; targetCents: number; startDate: string; endDate: string }
export type DashboardWidget = 'balance' | 'summary' | 'cashchart' | 'categories' | 'recent' | 'accounts' | 'portfolio' | 'rates'
export interface Settings { profileName: string; openTabs: string[]; activeTab: string; screen: Screen; compact: boolean; displayCurrency?: string; dashboardLayout?: string; dashboardWidgets?: DashboardWidget[]; defaultAccountId?: string | null }
export interface Bill { creditCardId?: string; cardPurchaseId?: string; statementId?: string; installmentIndex?: number; subcategoryId?: string | null; id: string; name: string; currency: string; projectId: string; categoryId: string; accountId: string | null; dueDate: string; amountCents: number | null; estimateCents: number; notes: string; templateId: string | null; loanId: string | null; principalCents: number; pendingId: string | null; canceled: boolean }
export interface Commitment { id: string; name: string; currency: string; projectId: string; categoryId: string; accountId: string | null; amountCents: number | null; estimateCents: number; notes: string; startDate: string; endDate: string | null; paused: boolean; estimateMode: 'manual' | 'last' | 'average' }
export interface BillPayment { statementPaymentId?: string; statementId?: string; id: string; billId: string; transactionId: string; accountId: string; paidDate: string; appliedCents: number; totalCents: number; interestCents: number; fineCents: number; feeCents: number; discountCents: number; adjustmentCents: number; principalCents: number; notes: string }
export interface Loan { id: string; name: string; institution: string; currency: string; projectId: string; categoryId: string; accountId: string; contractedCents: number; openingBalanceCents: number; openingDate: string; rateNotes: string; notes: string; disbursementId: string | null }
export interface LoanInstallment { dueDate: string; principalCents: number; interestCents: number }
export interface PropertyAsset { id: string; name: string; kind: string; icon: string; currency: string; projectId: string | null; acquisitionDate: string; acquisitionCents: number; ownershipPercent: number; loanId: string | null; notes: string; archived: boolean; valuations: { date: string; valueCents: number; source: string }[] }
export interface Investment {
  id: string; name: string; symbol: string; kind: 'fixed' | 'crypto' | 'stock' | 'etf' | 'fii' | 'fund' | 'bond' | 'commodity' | 'other';
  provider: 'manual' | 'coinbase' | 'brapi' | 'twelve'; currency: string; exchange: string; icon: string;
  accountId: string | null; projectId: string | null; quantity: number; costPrice: number; fees: number; openedDate: string;
  benchmark: 'cdi' | 'selic' | 'fixed'; rate: number; taxMode: 'regressive' | 'fixed' | 'exempt'; taxPercent: number; iof: boolean; annualFeePercent: number;
  manualPrice: number | null; closedDate: string | null; salePrice: number | null;
}
export interface MarketPoint { time: number; open: number; high: number; low: number; close: number }
export interface Quote { price: number; currency: string; time: string; fetchedAt: string; source: string; status: string }
export interface Rates { cdiDaily: number; cdiAnnual: number; selicDaily: number; selicTarget: number; date: string; selicDate: string; fetchedAt: string; source: string }
export interface FxRates { base: string; rates: Record<string, number>; date: string; fetchedAt: string; source: string }
export interface MarketCache { rates?: Rates; fx?: FxRates; [key: string]: unknown }
export interface AssetSearch { name: string; symbol: string; currency: string; exchange: string; provider: Investment['provider']; kind: Investment['kind'] }
export interface Snapshot {
  creditCards?: CreditCard[]; cardPurchases?: CardPurchase[]; cardStatements?: CardStatement[];
  attachments?: { id: string; ownerType: 'bill' | 'loan' | 'property'; ownerId: string; name: string; size: number; createdAt: string }[];
  commitments?: Commitment[]; bills?: Bill[]; payments?: BillPayment[]; loans?: Loan[]; assets?: PropertyAsset[];
  projects: Project[]; accounts: Account[]; categories: Category[]; transactions: Transaction[];
  transfers: Transfer[]; goals: Goal[]; settings: Settings;
  investments?: Investment[]; market?: MarketCache;
  meta: { databasePath: string; lastBackup: string | null; appVersion: string; backupWarning?: string | null };
}
export interface Filters { start: string; end: string; accountId: string; excludedAccountIds: string[]; categoryId: string; subcategoryId: string; status: 'all' | 'pending' | 'settled'; search: string }
export interface ElectronAPI {
  saveCreditCard(data: Omit<CreditCard, 'id'> & { id?: string }): Promise<CreditCard>;
  saveCardPurchase(data: Omit<CardPurchase, 'id' | 'canceled'> & { id?: string }): Promise<CardPurchase>;
  cancelCardPurchase(data: { id: string }): Promise<unknown>;
  saveStatementDates(data: { id: string; closingDate: string; dueDate: string }): Promise<unknown>;
  payCardStatement(data: { requestId: string; statementId: string; accountId: string; paidDate: string; amountCents: number }): Promise<unknown>;
  undoCardStatementPayment(data: { requestId: string }): Promise<unknown>;
  importAttachment(data: { ownerType: 'bill' | 'loan' | 'property'; ownerId: string }): Promise<unknown>;
  exportAttachment(data: { id: string }): Promise<unknown>;
  deleteAttachment(data: { id: string }): Promise<unknown>;
  saveBill(data: Omit<Bill, 'id' | 'templateId' | 'loanId' | 'principalCents' | 'pendingId' | 'canceled'> & { id?: string }): Promise<Bill>;
  adoptBill(data: { id: string }): Promise<Bill>;
  cancelBill(data: { id: string; canceled: boolean }): Promise<unknown>;
  saveCommitment(data: Omit<Commitment, 'id'> & { id?: string }): Promise<unknown>;
  payBill(data: { requestId: string; billId: string; accountId?: string; paidDate?: string; appliedCents?: number; totalCents?: number; interestCents?: number; fineCents?: number; feeCents?: number; discountCents?: number; notes?: string }): Promise<BillPayment>;
  undoPayment(data: { id: string }): Promise<unknown>;
  saveLoan(data: Omit<Loan, 'id' | 'disbursementId'> & { id?: string; receiveFunds?: boolean; schedule: LoanInstallment[] }): Promise<unknown>;
  saveProperty(data: Omit<PropertyAsset, 'id'> & { id?: string }): Promise<unknown>;
  setMarketStreaming(enabled: boolean): Promise<unknown>;
  onMarketUpdate(callback: () => void): () => void;
  saveInvestment(data: Omit<Investment, 'id'> & { id?: string }): Promise<unknown>;
  deleteInvestment(data: { id: string }): Promise<unknown>;
  refreshMarkets(): Promise<{ errors: string[] }>;
  searchAssets(data: { query: string; provider: string }): Promise<AssetSearch[]>;
  assetHistory(data: { id: string; interval: string }): Promise<{ points: MarketPoint[]; source: string; fetchedAt: string; cached?: boolean }>;
  providerStatus(): Promise<{ twelve: boolean; brapi: boolean }>;
  saveProviderKey(data: { provider: string; key: string }): Promise<unknown>;
  importIcon(): Promise<{ canceled: boolean; icon?: string }>;
  getSnapshot(): Promise<Snapshot>;
  saveProject(data: Partial<Project> & Pick<Project, 'name' | 'color'>): Promise<unknown>;
  saveAccount(data: Omit<Account, 'id'> & { id?: string }): Promise<unknown>;
  saveCategory(data: Omit<Category, 'id'> & { id?: string }): Promise<unknown>;
  saveTransaction(data: TransactionInput): Promise<unknown>;
  deleteTransaction(data: { id: string; scope: 'one' | 'future' }): Promise<unknown>;
  settleTransaction(data: { id: string; paidDate: string }): Promise<unknown>;
  saveTransfer(data: Omit<Transfer, 'id'> & { id?: string }): Promise<unknown>;
  deleteTransfer(data: { id: string }): Promise<unknown>;
  saveGoal(data: Omit<Goal, 'id'> & { id?: string }): Promise<unknown>;
  deleteGoal(data: { id: string }): Promise<unknown>;
  saveSettings(data: Partial<Settings>): Promise<unknown>;
  backup(): Promise<{ canceled: boolean; path?: string }>;
  restore(): Promise<{ canceled: boolean; path?: string }>;
  exportCsv(data: { filename: string; rows: string[][] }): Promise<{ canceled: boolean; path?: string }>;
  printReport(data: { title: string; subtitle: string; headers: string[]; rows: string[][]; totals: string[] }): Promise<{ canceled: boolean; path?: string }>;
  toggleFullscreen(): Promise<boolean>;
}
export type Commit = (action: () => Promise<unknown>, success: string) => Promise<boolean>
declare global { interface Window { electronAPI?: ElectronAPI } }
