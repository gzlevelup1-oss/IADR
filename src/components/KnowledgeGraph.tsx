import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Search, ZoomIn, ZoomOut, Maximize2, Filter, Info } from 'lucide-react';
import { cn } from '../App';

interface Props {
  nodes: any[];
  decisions: any[];
  conflicts?: any[];
  onNodeClick: (id: string) => void;
}

export const KnowledgeGraphView: React.FC<Props> = ({ nodes = [], decisions = [], conflicts = [], onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(true);

  const d3Nodes = useMemo(() => {
    const allNodes = [
      ...nodes.filter(n => n).map(n => ({ 
        ...n, 
        type: 'node', 
        label: (n.text || '').substring(0, 30) + (n.text?.length > 30 ? '...' : '') 
      })),
      ...decisions.filter(d => d).map(d => ({ 
        ...d, 
        type: 'decision', 
        label: (d.title || 'Untitled').substring(0, 30) + (d.title?.length > 30 ? '...' : '') 
      }))
    ];
    return allNodes;
  }, [nodes, decisions]);

  const d3Links = useMemo(() => {
    const links: any[] = [];
    decisions.forEach(d => {
      d.relatedNodeIds?.forEach((nodeId: string) => {
        if (nodes.find(n => n.id === nodeId)) {
          links.push({ source: d.id, target: nodeId, type: 'decision-node' });
        }
      });
    });
    return links;
  }, [nodes, decisions]);

  useEffect(() => {
    if (!svgRef.current || d3Nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Layer positions for clustering
    const layerCenters: Record<string, { x: number, y: number }> = {
      'infrastructure': { x: width * 0.2, y: height * 0.2 },
      'data': { x: width * 0.8, y: height * 0.2 },
      'logic': { x: width * 0.5, y: height * 0.5 },
      'interface': { x: width * 0.2, y: height * 0.8 },
      'cross-cutting': { x: width * 0.8, y: height * 0.8 },
      'decision': { x: width * 0.5, y: height * 0.2 }
    };

    const simulation = d3.forceSimulation(d3Nodes as any)
      .force('link', d3.forceLink(d3Links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))
      .force('x', d3.forceX().x((d: any) => {
        const center = layerCenters[d.type === 'decision' ? 'decision' : d.layer];
        return center ? center.x : width / 2;
      }).strength(0.1))
      .force('y', d3.forceY().y((d: any) => {
        const center = layerCenters[d.type === 'decision' ? 'decision' : d.layer];
        return center ? center.y : height / 2;
      }).strength(0.1));

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', '#262626')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Arrowhead definition
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#262626')
      .style('stroke', 'none');

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d === selectedNode ? null : d);
        if (d.sourceMessageId) onNodeClick(d.sourceMessageId);
      })
      .on('mouseover', (event, d) => setHoveredNode(d))
      .on('mouseout', () => setHoveredNode(null));

    // Node circles
    node.append('circle')
      .attr('r', (d: any) => d.type === 'decision' ? 12 : 8)
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
      .attr('stroke', (d: any) => {
        const isConflicting = conflicts.some(c => c.nodeIds?.includes(d.id));
        return isConflicting ? '#ef4444' : '#0A0A0A';
      })
      .attr('stroke-width', 2)
      .style('filter', (d: any) => {
        const isConflicting = conflicts.some(c => c.nodeIds?.includes(d.id));
        if (isConflicting) return 'drop-shadow(0 0 8px rgba(239,68,68,0.8))';
        return d.type === 'decision' ? 'drop-shadow(0 0 4px rgba(0,229,153,0.4))' : 'none';
      });

    // Node labels
    node.append('text')
      .text((d: any) => d.label)
      .attr('x', 15)
      .attr('y', 4)
      .attr('fill', '#9ca3af')
      .style('font-size', '9px')
      .style('font-family', 'monospace')
      .style('pointer-events', 'none')
      .style('font-weight', (d: any) => d.type === 'decision' ? 'bold' : 'normal')
      .style('opacity', 0.8);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      
      // Update visibility based on search and selection
      node.style('opacity', (d: any) => {
        if (searchQuery && !d.label.toLowerCase().includes(searchQuery.toLowerCase())) return 0.1;
        if (selectedNode) {
          const isConnected = d3Links.some(l => 
            (l.source.id === selectedNode.id && l.target.id === d.id) || 
            (l.target.id === selectedNode.id && l.source.id === d.id) ||
            d.id === selectedNode.id
          );
          return isConnected ? 1 : 0.1;
        }
        return 1;
      });

      link.style('opacity', (l: any) => {
        if (selectedNode) {
          return (l.source.id === selectedNode.id || l.target.id === selectedNode.id) ? 1 : 0.05;
        }
        return 0.4;
      });
    });

    svg.on('click', () => setSelectedNode(null));

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
  }, [d3Nodes, d3Links, searchQuery, selectedNode, conflicts]);

  const handleResetZoom = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(750).call(d3.zoom().transform as any, d3.zoomIdentity);
    }
  };

  return (
    <div className="w-full h-full bg-[#050505] relative overflow-hidden rounded-2xl border border-[#1A1A1A] flex flex-col">
      {/* Graph Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input 
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-4 py-2 text-[11px] text-white focus:outline-none focus:border-[#00E599] w-48 transition-all"
            />
          </div>
          <button 
            onClick={handleResetZoom}
            className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-gray-400 hover:text-white transition-colors"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={() => setShowLegend(!showLegend)}
            className={cn(
              "p-2 rounded-xl border transition-all",
              showLegend ? "bg-[#00E599]/10 border-[#00E599]/30 text-[#00E599]" : "bg-[#141414] border-[#262626] text-gray-400"
            )}
            title="Toggle Legend"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      <svg ref={svgRef} className="flex-1 w-full h-full cursor-move" />
      
      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 bg-[#0A0A0A]/80 backdrop-blur-md p-4 rounded-2xl border border-[#1A1A1A] space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Architecture Layers</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00E599]" />
              <span className="text-[10px] text-gray-400 font-mono">Decision</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#60a5fa]" />
              <span className="text-[10px] text-gray-400 font-mono">Infrastructure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#34d399]" />
              <span className="text-[10px] text-gray-400 font-mono">Data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
              <span className="text-[10px] text-gray-400 font-mono">Logic</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#c084fc]" />
              <span className="text-[10px] text-gray-400 font-mono">Interface</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fb7185]" />
              <span className="text-[10px] text-gray-400 font-mono">Cross-cutting</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#1A1A1A] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
            <span className="text-[10px] text-red-500 font-mono">Architectural Conflict</span>
          </div>
        </div>
      )}

      {/* Tooltip Overlay */}
      {hoveredNode && (
        <div className="absolute top-16 left-4 right-4 pointer-events-none">
          <div className="bg-[#141414]/95 backdrop-blur-xl border border-[#262626] p-4 rounded-2xl shadow-2xl max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  hoveredNode.type === 'decision' ? "bg-[#00E599]" : "bg-blue-400"
                )} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {hoveredNode.type === 'decision' ? 'Decision Record' : hoveredNode.layer}
                </span>
              </div>
              {hoveredNode.confidence && (
                <span className="text-[10px] font-mono text-[#00E599]">{hoveredNode.confidence}% Confidence</span>
              )}
            </div>
            <p className="text-[13px] text-white leading-relaxed font-medium">
              {hoveredNode.type === 'decision' ? hoveredNode.title : hoveredNode.text}
            </p>
            {hoveredNode.summary && (
              <p className="mt-2 text-[11px] text-gray-500 line-clamp-2 italic">
                {hoveredNode.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selection Info */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 w-64 bg-[#0A0A0A]/90 backdrop-blur-md border border-[#00E599]/30 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-bold text-[#00E599] uppercase tracking-widest">Selection Details</h4>
            <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white"><Maximize2 className="w-3 h-3" /></button>
          </div>
          <p className="text-xs text-white font-medium mb-2">{selectedNode.type === 'decision' ? selectedNode.title : selectedNode.text}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Type</span>
              <span className="text-gray-300 capitalize">{selectedNode.type}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Layer</span>
              <span className="text-gray-300 capitalize">{selectedNode.layer || 'N/A'}</span>
            </div>
            {selectedNode.status && (
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Status</span>
                <span className="text-gray-300 capitalize">{selectedNode.status}</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => selectedNode.sourceMessageId && onNodeClick(selectedNode.sourceMessageId)}
            className="mt-4 w-full py-2 rounded-lg bg-[#00E599]/10 border border-[#00E599]/20 text-[10px] font-bold text-[#00E599] uppercase tracking-widest hover:bg-[#00E599]/20 transition-all"
          >
            Go to Source
          </button>
        </div>
      )}
    </div>
  );
};

