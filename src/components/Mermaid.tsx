import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'monospace',
});

interface Props {
  chart: string;
  enableZoom?: boolean;
}

export const Mermaid: React.FC<Props> = ({ chart, enableZoom = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const id = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const renderChart = async () => {
      if (!containerRef.current || !chart) return;
      
      try {
        // Clear previous content
        containerRef.current.innerHTML = '';
        const { svg } = await mermaid.render(id.current, chart);
        
        // Check if still mounted after async render
        if (!isMounted || !containerRef.current) return;
        
        // Ensure container has dimensions before rendering SVG to prevent d3 errors
        if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
           // Retry after a short delay if container is not yet visible
           timeoutId = setTimeout(renderChart, 100);
           return;
        }

        containerRef.current.innerHTML = svg;
        
        const svgElement = containerRef.current.querySelector('svg');
        if (svgElement) {
          svgRef.current = svgElement;
          svgElement.style.maxWidth = '100%';
          svgElement.style.height = 'auto';
          svgElement.style.display = 'block';
          
          if (enableZoom) {
            setupZoom(svgElement);
          }
        }
      } catch (error) {
        console.error('Mermaid rendering failed:', error);
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = `<div class="text-red-500 text-xs p-2 border border-red-500/20 rounded bg-red-500/5">Failed to render diagram</div>`;
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [chart, enableZoom]);

  const setupZoom = (svgElement: SVGSVGElement) => {
    const svg = d3.select(svgElement);
    
    // Create a zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        // Apply transform to all top-level g elements
        svg.selectAll('svg > g').attr('transform', event.transform);
        setIsZoomed(event.transform.k !== 1 || event.transform.x !== 0 || event.transform.y !== 0);
      });

    svg.call(zoom);
    
    // Store zoom instance on element for external access
    (svgElement as any).__zoom_behavior = zoom;
  };

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = (svgRef.current as any).__zoom_behavior;
      if (zoom) {
        svg.transition().duration(300).call(zoom.scaleBy, 1.3);
      }
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = (svgRef.current as any).__zoom_behavior;
      if (zoom) {
        svg.transition().duration(300).call(zoom.scaleBy, 0.7);
      }
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = (svgRef.current as any).__zoom_behavior;
      if (zoom) {
        svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      }
    }
  };

  return (
    <div className="relative group w-full h-full flex flex-col">
      {enableZoom && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button 
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-[#141414] border border-[#262626] text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-[#141414] border border-[#262626] text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handleReset}
            className={cn(
              "p-1.5 rounded bg-[#141414] border transition-all",
              isZoomed ? "border-emerald-500/50 text-emerald-400" : "border-[#262626] text-gray-400 hover:text-emerald-400"
            )}
            title="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div 
        className={cn(
          "mermaid flex-1 flex justify-center w-full overflow-hidden py-4 cursor-grab active:cursor-grabbing",
          enableZoom ? "min-h-[300px]" : ""
        )} 
        ref={containerRef} 
      />
    </div>
  );
};

// Helper for tailwind classes if not imported
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
