import React from 'react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import styles from './AnimatedNumber.module.css';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  onAnimationStart?: () => void;
  onAnimationEnd?: () => void;
  onCardAnimationStart?: () => void;
  onCardAnimationEnd?: () => void;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.2,
  className = '',
  onAnimationStart,
  onAnimationEnd,
  onCardAnimationStart,
  onCardAnimationEnd
}) => {
  const { animatedValue, isAnimating } = useAnimatedNumber({
    value,
    duration,
    prefix,
    suffix,
    decimals,
    onAnimationStart: () => {
      onAnimationStart?.();
      onCardAnimationStart?.();
    },
    onAnimationEnd: () => {
      onAnimationEnd?.();
      onCardAnimationEnd?.();
    }
  });

  return (
    <span className={`${styles.animatedNumber} ${isAnimating ? styles.animating : ''} ${className}`}>
      {animatedValue}
    </span>
  );
};

export default AnimatedNumber;
