import React from 'react';
import { Settings, Share2, Trash2 } from 'lucide-react';
import { cn } from '../App';

interface ProjectItemProps {
  project: any;
  currentProjectId: string | null;
  onSelect: (id: string) => void;
  onSettings: (id: string) => void;
  onExport: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onUpdateStrategy: (id: string, strategy: 'mvp' | 'scale' | 'hybrid') => void;
}

export const ProjectItem = React.memo(({ 
  project, 
  currentProjectId, 
  onSelect, 
  onSettings, 
  onExport, 
  onDelete,
  onUpdateStrategy
}: ProjectItemProps) => {
  return (
    <div 
      onClick={() => onSelect(project.id)}
      className={cn(
        "group p-3 rounded-xl border transition-all cursor-pointer relative",
        currentProjectId === project.id 
          ? "bg-[#141414] border-[#00E599]/30 text-white" 
          : "border-transparent text-gray-500 hover:bg-[#111] hover:text-gray-300"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium truncate pr-8">{project.name}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onSettings(project.id); }}
            className="p-1 hover:text-[#00E599]"
            title="Settings"
          >
            <Settings className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => onExport(project.id, e)}
            className="p-1 hover:text-blue-400"
            title="Export"
          >
            <Share2 className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => onDelete(project.id, e)}
            className="p-1 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="text-[10px] opacity-50 font-mono flex justify-between items-center">
        <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        <select 
          value={project.strategy}
          onChange={(e) => onUpdateStrategy(project.id, e.target.value as any)}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent text-[9px] border border-white/10 rounded px-1 hover:border-[#00E599]/50 transition-colors"
        >
          <option value="mvp" className="bg-[#0A0A0A]">MVP</option>
          <option value="scale" className="bg-[#0A0A0A]">SCALE</option>
          <option value="hybrid" className="bg-[#0A0A0A]">HYBRID</option>
        </select>
      </div>
    </div>
  );
});
