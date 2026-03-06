import React, { useState, useMemo } from 'react';
import LineChart from '../LineChart/LineChart';
import styles from './Statistics.module.css';

interface StatisticsProps {
  className?: string;
}

const Statistics: React.FC<StatisticsProps> = ({ className = '' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('7');

  // Memoizar dados para evitar recriação
  const last7DaysData = useMemo(() => {
    const today = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        expenses: Math.floor(Math.random() * 500) + 200,
        income: Math.floor(Math.random() * 800) + 400
      });
    }
    
    return data;
  }, []);

  const last30DaysData = useMemo(() => {
    const today = new Date();
    const data = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        expenses: Math.floor(Math.random() * 600) + 150,
        income: Math.floor(Math.random() * 1000) + 300
      });
    }
    
    return data;
  }, []);

  const last90DaysData = useMemo(() => {
    const today = new Date();
    const data = [];
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        expenses: Math.floor(Math.random() * 800) + 100,
        income: Math.floor(Math.random() * 1200) + 200
      });
    }
    
    return data;
  }, []);

  const chartData = useMemo(() => {
    switch (selectedPeriod) {
      case '7':
        return last7DaysData;
      case '30':
        return last30DaysData;
      case '90':
        return last90DaysData;
      default:
        return last7DaysData;
    }
  }, [selectedPeriod, last7DaysData, last30DaysData, last90DaysData]);

  const handlePeriodChange = (period: '7' | '30' | '90') => {
    setSelectedPeriod(period);
  };

  return (
    <div className={`${styles.statistics} ${className}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>Estatísticas Gerais</h2>
        <div className={styles.periodFilters}>
          <button
            className={`${styles.periodBtn} ${selectedPeriod === '7' ? styles.active : ''}`}
            onClick={() => handlePeriodChange('7')}
          >
            7 dias
          </button>
          <button
            className={`${styles.periodBtn} ${selectedPeriod === '30' ? styles.active : ''}`}
            onClick={() => handlePeriodChange('30')}
          >
            30 dias
          </button>
          <button
            className={`${styles.periodBtn} ${selectedPeriod === '90' ? styles.active : ''}`}
            onClick={() => handlePeriodChange('90')}
          >
            90 dias
          </button>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <LineChart 
          data={chartData} 
          width={undefined} 
          height={320} // Ajustado para preencher melhor o espaço
        />
      </div>
    </div>
  );
};

export default Statistics;
