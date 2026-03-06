import React, { useState } from 'react';
import AnimatedNumber from '../AnimatedNumber/AnimatedNumber';
import styles from './AnimatedCard.module.css';

interface AnimatedCardProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  children: React.ReactNode;
  positive?: boolean;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.5,
  className = '',
  children,
  positive
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleAnimationStart = () => {
    setIsAnimating(true);
  };

  const handleAnimationEnd = () => {
    setIsAnimating(false);
  };

  return (
    <div className={`${styles.animatedCard} ${isAnimating ? styles.animating : ''} ${positive ? styles.positive : styles.negative} ${className}`}>
      {children}
      <AnimatedNumber 
        value={value} 
        prefix={prefix}
        suffix={suffix}
        decimals={decimals}
        duration={duration}
        onAnimationStart={handleAnimationStart}
        onAnimationEnd={handleAnimationEnd}
        className={positive ? styles.positive : styles.negative}
      />
    </div>
  );
};

export default AnimatedCard;
