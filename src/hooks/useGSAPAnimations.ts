import { useRef } from 'react';
import { gsap } from 'gsap';

export const useGSAPAnimations = () => {
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const buttonRefs = useRef<(HTMLElement | null)[]>([]);

  // Animação para cards
  const animateCardHover = (element: HTMLElement) => {
    const tl = gsap.timeline();
    
    // Hover enter
    element.addEventListener('mouseenter', () => {
      tl.to(element, {
        scale: 1.02,
        y: -4,
        boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
        duration: 0.3,
        ease: 'power2.out'
      });
    });

    // Hover leave
    element.addEventListener('mouseleave', () => {
      tl.to(element, {
        scale: 1,
        y: 0,
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
        duration: 0.3,
        ease: 'power2.out'
      });
    });
  };

  // Animação de luz para botões
  const animateButtonLight = (element: HTMLElement) => {
    // Criar elemento de luz
    const light = document.createElement('div');
    light.style.position = 'absolute';
    light.style.top = '0';
    light.style.left = '0';
    light.style.width = '100%';
    light.style.height = '100%';
    light.style.background = 'linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent)';
    light.style.transform = 'translateX(-100%)';
    light.style.pointerEvents = 'none';
    light.style.borderRadius = 'inherit';
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(light);

    // Animação de hover
    element.addEventListener('mouseenter', () => {
      gsap.to(element, {
        scale: 1.05,
        duration: 0.2,
        ease: 'power2.out'
      });
      
      // Animação da luz
      gsap.to(light, {
        x: '200%',
        duration: 0.6,
        ease: 'power2.out'
      });
    });

    element.addEventListener('mouseleave', () => {
      gsap.to(element, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out'
      });
      
      // Reset da luz
      gsap.set(light, {
        x: '-100%'
      });
    });

    // Click animation
    element.addEventListener('click', () => {
      gsap.to(element, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });
    });
  };

  // Registrar cards para animação
  const registerCard = (element: HTMLElement | null) => {
    if (element && !cardRefs.current.includes(element)) {
      cardRefs.current.push(element);
      animateCardHover(element);
    }
  };

  // Registrar botões para animação
  const registerButton = (element: HTMLElement | null) => {
    if (element && !buttonRefs.current.includes(element)) {
      buttonRefs.current.push(element);
      animateButtonLight(element);
    }
  };

  // Limpar referências
  const cleanup = () => {
    cardRefs.current = [];
    buttonRefs.current = [];
  };

  return {
    registerCard,
    registerButton,
    cleanup
  };
};
