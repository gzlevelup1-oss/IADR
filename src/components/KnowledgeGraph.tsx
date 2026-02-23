import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { cn } from '../App';

type Node = {
  id: string;
  text: string;
  type: 'node' | 'decision';
  layer: string;
  confidence: number;
};

type Link = {
  source: string;
  target: string;
};

interface Props {
  nodes: any[];
  decisions: any[];
  onNodeClick: (id: string) => void;
}

export const KnowledgeGraphView: React.FC<Props> = ({ nodes = [], decisions = [], onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = React.useState<any>(null);

  useEffect(() => {
    if (!svgRef.current || (nodes.length === 0 && decisions.length === 0)) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Prepare data
    const d3Nodes: any[] = [
      ...nodes.filter(n => n).map(n => ({ ...n, type: 'node', label: (n.text || '').substring(0, 20) + (n.text?.length > 20 ? '...' : '') })),
      ...decisions.filter(d => d).map(d => ({ ...d, type: 'decision', label: (d.title || 'Untitled').substring(0, 20) + (d.title?.length > 20 ? '...' : '') }))
    ];

    const d3Links: any[] = [];
    decisions.forEach(d => {
      d.relatedNodeIds?.forEach((nodeId: string) => {
        if (nodes.find(n => n.id === nodeId)) {
          d3Links.push({ source: d.id, target: nodeId });
        }
      });
    });

    const simulation = d3.forceSimulation(d3Nodes)
      .force('link', d3.forceLink(d3Links).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    const link = g.append('g')
      .attr('stroke', '#262626')
      .attr('stroke-opacity', 0.4)
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('stroke-width', 1);

    const node = g.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => onNodeClick(d.sourceMessageId))
      .on('mouseover', (event, d) => setHoveredNode(d))
      .on('mouseout', () => setHoveredNode(null));

    node.append('circle')
      .attr('r', (d: any) => d.type === 'decision' ? 14 : 10)
      .attr('fill', (d: any) => {
        if (d.type === 'decision') return '#00E599';
        switch (d.layer) {
          case 'infrastructure': return '#60a5fa';
          case 'data': return '#34d399';
          case 'logic': return '#fbbf24';
          case 'interface': return '#c084fc';
          case 'cross-cutting': return '#fb7185';
          default: return '#9ca3af';
        }
      })
      .attr('stroke', '#0A0A0A')
      .attr('stroke-width', 2)
      .style('filter', (d: any) => d.type === 'decision' ? 'drop-shadow(0 0 4px rgba(0,229,153,0.4))' : 'none');

    node.append('text')
      .text((d: any) => d.label)
      .attr('x', 18)
      .attr('y', 5)
      .attr('fill', '#9ca3af')
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .style('pointer-events', 'none')
      .style('font-weight', (d: any) => d.type === 'decision' ? 'bold' : 'normal');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, decisions]);

  return (
    <div className="w-full h-full bg-[#0A0A0A] relative overflow-hidden rounded-2xl border border-[#1A1A1A]">
      <svg ref={svgRef} className="w-full h-full cursor-move" />
      
      {/* Tooltip Overlay */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 right-4 pointer-events-none">
          <div className="bg-[#141414]/90 backdrop-blur-md border border-[#262626] p-3 rounded-xl shadow-2xl max-w-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                hoveredNode.type === 'decision' ? "bg-[#00E599]" : "bg-gray-500"
              )} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {hoveredNode.type === 'decision' ? 'Decision' : hoveredNode.layer}
              </span>
            </div>
            <p className="text-xs text-white leading-relaxed">
              {hoveredNode.type === 'decision' ? hoveredNode.title : hoveredNode.text}
            </p>
            {hoveredNode.confidence && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#00E599]" 
                    style={{ width: `${hoveredNode.confidence}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-gray-500">{hoveredNode.confidence}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex flex-col gap-2 bg-[#0A0A0A]/60 backdrop-blur-sm p-3 rounded-xl border border-[#1A1A1A]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00E599] shadow-[0_0_8px_rgba(0,229,153,0.5)]" />
          <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">Decision</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-gray-600" />
          <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">Insight</span>
        </div>
      </div>
    </div>
  );
};
