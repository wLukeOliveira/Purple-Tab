import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { gsap } from 'gsap';
import styles from './LineChart.module.css';

interface LineChartProps {
  data: Array<{
    date: string;
    expenses: number;
    income: number;
  }>;
  width?: number;
  height?: number;
}

const LineChart: React.FC<LineChartProps> = ({ 
  data, 
  width = 800, 
  height = 300 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoizar os dados processados para evitar recriação
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(d => ({
      ...d,
      dateObj: new Date(d.date)
    }));
  }, [data]);

  // Obter dimensões do container
  const [dimensions, setDimensions] = useState({ width: 800, height: 300 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: containerWidth, // Usa largura total do container
          height: containerHeight || 300 // Usa altura total do container
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Função para formatar valores do eixo Y
  const formatYAxisLabel = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return `R$ ${value}`;
  };

  useEffect(() => {
    if (!processedData.length || !svgRef.current) return;

    // Cancelar animação anterior se existir
    if (animationRef.current) {
      animationRef.current.kill();
    }

    const svg = d3.select(svgRef.current);
    
    // Limpar apenas o conteúdo, não o SVG inteiro
    const g = svg.select('g');
    if (g.empty()) {
      // Primeira renderização - criar estrutura
      svg.append('g').attr('class', 'main-group');
    } else {
      // Renderizações subsequentes - limpar apenas o conteúdo
      g.selectAll('*').remove();
    }

    const mainGroup = svg.select('.main-group');
    const margin = { top: 15, right: 15, bottom: 50, left: 65 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Criar escalas
    const xScale = d3.scaleTime()
      .domain(d3.extent(processedData, d => d.dateObj) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => Math.max(d.expenses, d.income)) || 0])
      .range([innerHeight, 0]);

    // Criar linhas
    const expensesLine = d3.line<typeof processedData[0]>()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.expenses))
      .curve(d3.curveMonotoneX);

    const incomeLine = d3.line<typeof processedData[0]>()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.income))
      .curve(d3.curveMonotoneX);

    // Criar área para despesas
    const expensesArea = d3.area<typeof processedData[0]>()
      .x(d => xScale(d.dateObj))
      .y0(innerHeight)
      .y1(d => yScale(d.expenses))
      .curve(d3.curveMonotoneX);

    // Posicionar o grupo principal
    mainGroup.attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    mainGroup.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-innerHeight)
        .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.1);

    mainGroup.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.1);

    // Área de despesas
    const areaPath = mainGroup.append('path')
      .datum(processedData)
      .attr('class', 'expenses-area')
      .attr('d', expensesArea)
      .style('fill', 'url(#expensesGradient)')
      .style('opacity', 0);

    // Gradientes (criar apenas uma vez)
    if (svg.select('defs').empty()) {
      const defs = svg.append('defs');
      
      // Gradiente para despesas
      const expensesGradient = defs.append('linearGradient')
        .attr('id', 'expensesGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      expensesGradient.append('stop')
        .attr('offset', '0%')
        .style('stop-color', '#ef4444')
        .style('stop-opacity', 0.3);

      expensesGradient.append('stop')
        .attr('offset', '100%')
        .style('stop-color', '#ef4444')
        .style('stop-opacity', 0.05);

      // Gradiente para receitas
      const incomeGradient = defs.append('linearGradient')
        .attr('id', 'incomeGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      incomeGradient.append('stop')
        .attr('offset', '0%')
        .style('stop-color', '#10b981')
        .style('stop-opacity', 0.3);

      incomeGradient.append('stop')
        .attr('offset', '100%')
        .style('stop-color', '#10b981')
        .style('stop-opacity', 0.05);
    }

    // Linha de despesas
    const expensesPath = mainGroup.append('path')
      .datum(processedData)
      .attr('class', 'expenses-line')
      .attr('d', expensesLine)
      .style('fill', 'none')
      .style('stroke', '#ef4444')
      .style('stroke-width', 3)
      .style('opacity', 0);

    // Linha de receitas
    const incomePath = mainGroup.append('path')
      .datum(processedData)
      .attr('class', 'income-line')
      .attr('d', incomeLine)
      .style('fill', 'none')
      .style('stroke', '#10b981')
      .style('stroke-width', 3)
      .style('opacity', 0);

    // Pontos de dados
    const expensesCircles = mainGroup.selectAll('.expenses-circle')
      .data(processedData)
      .enter()
      .append('circle')
      .attr('class', 'expenses-circle')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.expenses))
      .attr('r', 0)
      .style('fill', '#ef4444')
      .style('stroke', '#fff')
      .style('stroke-width', 2);

    const incomeCircles = mainGroup.selectAll('.income-circle')
      .data(processedData)
      .enter()
      .append('circle')
      .attr('class', 'income-circle')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.income))
      .attr('r', 0)
      .style('fill', '#10b981')
      .style('stroke', '#fff')
      .style('stroke-width', 2);

    // Eixos
    const xAxis = d3.axisBottom(xScale)
      .tickFormat((domainValue: any) => d3.timeFormat('%d/%m')(domainValue as Date));

    const yAxis = d3.axisLeft(yScale)
      .tickFormat((domainValue: any) => formatYAxisLabel(domainValue as number));

    const xAxisGroup = mainGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    const yAxisGroup = mainGroup.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    // Aplicar estilos aos eixos
    xAxisGroup.selectAll('text')
      .style('font-size', '12px')
      .style('color', '#64748b');

    yAxisGroup.selectAll('text')
      .style('font-size', '12px')
      .style('color', '#64748b');

    // Animações com GSAP
    const tl = gsap.timeline();
    animationRef.current = tl;

    // Animar área
    tl.to(areaPath.node(), {
      opacity: 1,
      duration: 1,
      ease: 'power2.out'
    });

    // Animar linha de despesas
    const expensesPathNode = expensesPath.node();
    if (expensesPathNode) {
      const expensesPathLength = (expensesPathNode as any).getTotalLength();
      expensesPath
        .attr('stroke-dasharray', expensesPathLength)
        .attr('stroke-dashoffset', expensesPathLength);
      
      tl.to(expensesPathNode, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: 'power2.inOut'
      }, '-=0.5');
    }

    // Animar linha de receitas
    const incomePathNode = incomePath.node();
    if (incomePathNode) {
      const incomePathLength = (incomePathNode as any).getTotalLength();
      incomePath
        .attr('stroke-dasharray', incomePathLength)
        .attr('stroke-dashoffset', incomePathLength);
      
      tl.to(incomePathNode, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: 'power2.inOut'
      }, '-=1');
    }

    // Animar círculos
    tl.to(expensesCircles.nodes(), {
      attr: { r: 5 },
      duration: 0.3,
      stagger: 0.1,
      ease: 'back.out(1.7)'
    }, '-=0.5')
    .to(incomeCircles.nodes(), {
      attr: { r: 5 },
      duration: 0.3,
      stagger: 0.1,
      ease: 'back.out(1.7)'
    }, '-=0.3');

    // Hover effects
    const handleMouseOver = (event: any) => {
      const circle = event.target;
      gsap.to(circle, {
        attr: { r: 8 },
        duration: 0.2,
        ease: 'power2.out'
      });
    };

    const handleMouseOut = (event: any) => {
      const circle = event.target;
      gsap.to(circle, {
        attr: { r: 5 },
        duration: 0.2,
        ease: 'power2.out'
      });
    };

    expensesCircles
      .on('mouseover', handleMouseOver)
      .on('mouseout', handleMouseOut);

    incomeCircles
      .on('mouseover', handleMouseOver)
      .on('mouseout', handleMouseOut);

    // Cleanup
    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };

  }, [processedData, dimensions]);

  return (
    <div ref={containerRef} className={styles.lineChart}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: '100%', height: '100%' }}
      />
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.expenses}`}></div>
          <span>Despesas</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.income}`}></div>
          <span>Receitas</span>
        </div>
      </div>
    </div>
  );
};

export default LineChart;
