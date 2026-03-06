import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  onAnimationStart?: () => void;
  onAnimationEnd?: () => void;
}

export const useAnimatedNumber = ({ 
  value, 
  duration = 1.2, 
  prefix = '', 
  suffix = '', 
  decimals = 0,
  onAnimationStart,
  onAnimationEnd
}: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    // Se o valor mudou significativamente, animar a transição
    if (previousValue.current !== value) {
      // Cancelar animação anterior se existir
      if (animationRef.current) {
        animationRef.current.kill();
      }

      const startValue = previousValue.current;
      const endValue = value;
      const difference = endValue - startValue;
      
      // Criar objeto para animação
      const obj = { value: startValue };
      
      // Determinar se é aumento ou diminuição para efeito visual
      const isIncreasing = difference > 0;
      
      // Iniciar animação
      setIsAnimating(true);
      onAnimationStart?.();
      
      // Animar o valor
      animationRef.current = gsap.to(obj, {
        value: endValue,
        duration: duration,
        ease: isIncreasing ? 'power2.out' : 'power2.in',
        onUpdate: function() {
          setDisplayValue(obj.value);
        },
        onComplete: function() {
          setDisplayValue(endValue);
          previousValue.current = endValue;
          setIsAnimating(false);
          onAnimationEnd?.();
        }
      });

      previousValue.current = value;
    }
  }, [value, duration, onAnimationStart, onAnimationEnd]);

  // Formatar o valor para exibição
  const formatValue = (num: number) => {
    const formatted = decimals > 0 
      ? num.toFixed(decimals)
      : Math.round(num).toString();
    
    // Adicionar separadores de milhar
    const withSeparators = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return `${prefix}${withSeparators}${suffix}`;
  };

  return {
    animatedValue: formatValue(displayValue),
    isAnimating
  };
};
