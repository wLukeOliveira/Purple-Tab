import React from 'react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import styles from './AnimatedPercentage.module.css';

interface AnimatedPercentageProps {
  value: string;
  duration?: number;
  className?: string;
  onAnimationStart?: () => void;
  onAnimationEnd?: () => void;
}

const AnimatedPercentage: React.FC<AnimatedPercentageProps> = ({
  value,
  duration = 1.5,
  className = '',
  onAnimationStart,
  onAnimationEnd
}) => {
  // Extrair o valor numérico da porcentagem (ex: "+12,3%" -> 12.3)
  const numericValue = parseFloat(value.replace(/[^\d.-]/g, ''));
  
  const { animatedValue, isAnimating } = useAnimatedNumber({
    value: numericValue,
    duration,
    suffix: '%',
    decimals: 1,
    onAnimationStart,
    onAnimationEnd
  });

  // Manter o sinal original
  const sign = value.includes('+') ? '+' : '';

  return (
    <span className={`${styles.animatedPercentage} ${isAnimating ? styles.animating : ''} ${className}`}>
      {sign}{animatedValue}
    </span>
  );
};

export default AnimatedPercentage;
