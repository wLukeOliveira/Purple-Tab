import { useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Obter valor do localStorage ou usar valor inicial
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.error(`Erro ao ler do localStorage (chave: ${key}):`, error);
      return initialValue;
    }
  });

  // Função para atualizar valor no localStorage e estado
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Erro ao salvar no localStorage (chave: ${key}):`, error);
    }
  };

  return [storedValue, setValue] as const;
}
