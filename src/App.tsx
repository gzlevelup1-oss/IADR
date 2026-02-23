/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, FileText, Server, AlertTriangle, ListChecks, Download, Loader2, Sparkles, MessageSquare, Layers, Target, Zap, Shield, Database, Layout, Link2, ChevronRight, Activity, Share2, Edit2, Trash2, X, Copy, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KnowledgeGraphView } from './components/KnowledgeGraph';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = { id: string; role: 'user' | 'model'; text: string };

type KnowledgeCategory = 'use-case' | 'system-design' | 'implementation' | 'ambition' | 'constraint';
type KnowledgeLayer = 'infrastructure' | 'data' | 'logic' | 'interface' | 'cross-cutting';
type KnowledgeStatus = 'proposed' | 'verified' | 'discarded' | 'ambitious';

type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';

type Decision = {
  id: string;
  title: string;
  status: ADRStatus;
  date: string;
  deciders: string;
  summary: string;
  rationale: string;
  pros: string[];
  cons: string[];
  layer: KnowledgeLayer;
  confidence: number;
  relatedNodeIds: string[];
  sourceMessageId?: string;
};

type TradeOff = {
  id: string;
  topic: string;
  optionA: {
    name: string;
    description: string;
    pros: string[];
    cons: string[];
    cost: 'low' | 'medium' | 'high';
    complexity: 'low' | 'medium' | 'high';
  };
  optionB: {
    name: string;
    description: string;
    pros: string[];
    cons: string[];
    cost: 'low' | 'medium' | 'high';
    complexity: 'low' | 'medium' | 'high';
  };
  recommendation: string;
  strategyAlignment: string;
};

type Project = {
  id: string;
  name: string;
  strategy: 'mvp' | 'scale' | 'hybrid';
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  graph: KnowledgeGraph;
  tradeOffs: TradeOff[];
  syncIndex: number;
};

type KnowledgeNode = {
  id: string;
  text: string;
  category: KnowledgeCategory;
  layer: KnowledgeLayer;
  status: KnowledgeStatus;
  confidence: number; // 0-100
  sourceMessageId?: string;
};

type Conflict = {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  nodeIds: string[];
};

type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  decisions: Decision[];
  conflicts: Conflict[];
};

const LAYERS: { id: KnowledgeLayer; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'infrastructure', label: 'Infrastructure', icon: Server, color: 'text-blue-400' },
  { id: 'data', label: 'Data', icon: Database, color: 'text-emerald-400' },
  { id: 'logic', label: 'Logic', icon: Zap, color: 'text-amber-400' },
  { id: 'interface', label: 'Interface', icon: Layout, color: 'text-purple-400' },
  { id: 'cross-cutting', label: 'Cross-cutting', icon: Shield, color: 'text-rose-400' },
];

const CATEGORIES: Record<KnowledgeCategory, { label: string; icon: React.ElementType }> = {
  'use-case': { label: 'Use Case', icon: Target },
  'system-design': { label: 'System Design', icon: Layers },
  'implementation': { label: 'Implementation', icon: ListChecks },
  'ambition': { label: 'Ambition', icon: Sparkles },
  'constraint': { label: 'Constraint', icon: AlertTriangle },
};

const MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('archbot_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Migration: Ensure all projects have a strategy
          return parsed.map(p => ({
            ...p,
            strategy: p.strategy || 'mvp'
          }));
        }
      }
    } catch (e) {
      console.error("Failed to parse projects", e);
    }
    return [];
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem('archbot_current_project_id');
  });

  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [modelStatus, setModelStatus] = useState<Record<string, 'ok' | 'quota_exceeded'>>({});
  const [activeTab, setActiveTab] = useState<'chat' | 'map' | 'decisions' | 'matrix'>('chat');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], decisions: [], conflicts: [] });
  const [tradeOffs, setTradeOffs] = useState<TradeOff[]>([]);
  const lastSyncIndexRef = useRef<number>(0);

  // Load current project data
  useEffect(() => {
    const project = projects.find(p => p.id === currentProjectId);
    if (project) {
      setMessages(project.messages);
      setGraph(project.graph);
      setTradeOffs(project.tradeOffs || []);
      lastSyncIndexRef.current = project.syncIndex;
    } else if (projects.length > 0) {
      setCurrentProjectId(projects[0].id);
    } else {
      const initialProject: Project = {
        id: Math.random().toString(36).substring(7),
        name: 'Default Project',
        strategy: 'mvp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
          {
            id: '1',
            role: 'model',
            text: "Hello! I'm your R&D Architecture Assistant. What kind of system or feature are we designing today?"
          }
        ],
        graph: { nodes: [], decisions: [], conflicts: [] },
        tradeOffs: [],
        syncIndex: 0
      };
      setProjects([initialProject]);
      setCurrentProjectId(initialProject.id);
    }
  }, [currentProjectId]);

  // Save current project when data changes
  useEffect(() => {
    if (!currentProjectId) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id === currentProjectId) {
        return {
          ...p,
          messages,
          graph,
          tradeOffs,
          syncIndex: lastSyncIndexRef.current,
          updatedAt: Date.now()
        };
      }
      return p;
    }));
  }, [messages, graph, tradeOffs]);

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem('archbot_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem('archbot_current_project_id', currentProjectId);
    }
  }, [currentProjectId]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [visionMode, setVisionMode] = useState(false); // Vision Mode Toggle
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<KnowledgeLayer | 'all'>('all');
  const [editingNode, setEditingNode] = useState<KnowledgeNode | null>(null);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<KnowledgeGraph>(graph);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  // Initialize Gemini Chat Session
  useEffect(() => {
    if (!currentProjectId) return;
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const history = messages.length > 1 ? messages.slice(1).map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    })) : undefined;

    const currentProject = projects.find(p => p.id === currentProjectId);
    const strategyContext = (currentProject && currentProject.strategy) ? `The current project strategy is: ${currentProject.strategy.toUpperCase()}. 
    If strategy is MVP: Prioritize speed, lower cost, and "good enough" solutions that can be replaced later. 
    If strategy is SCALE: Prioritize robustness, high availability, and long-term maintainability even if it increases initial complexity.
    If strategy is HYBRID: Balance immediate speed with clear migration paths to scale.` : '';

    chatRef.current = ai.chats.create({
      model: selectedModel,
      history: history || [],
      config: {
        systemInstruction: `You are an expert System Architect and R&D assistant. Your goal is to help the user synthesize complex system designs. 
        ${strategyContext}
        Categorize insights into layers: Infrastructure, Data, Logic, Interface, and Cross-cutting. 
        Distinguish between immediate implementation constraints and long-term ambitions. 
        Ask clarifying questions to verify assumptions. Be technical, concise, and analytical.`
      }
    });
  }, [selectedModel, currentProjectId]); // Re-init chat when model or project changes

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const synthesizeKnowledge = async (currentMessages: Message[], retryCount = 0, forceFull = false) => {
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const startIndex = forceFull ? 0 : lastSyncIndexRef.current;
      const newMessages = currentMessages.slice(startIndex);
      
      if (newMessages.length === 0 && !forceFull) {
        setIsExtracting(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const conversationText = newMessages.map(m => `[ID: ${m.id}] ${m.role === 'user' ? 'User' : 'Architect'}: ${m.text}`).join('\n\n');
      const currentGraphText = forceFull ? '{"nodes":[],"decisions":[],"conflicts":[]}' : JSON.stringify(graphRef.current);

      const currentProject = projects.find(p => p.id === currentProjectId);
      const strategyContext = (currentProject && currentProject.strategy) ? `PROJECT STRATEGY: ${currentProject.strategy.toUpperCase()}. 
      When extracting nodes and decisions, consider if they are 'MVP-specific' or 'Future-scale'. 
      If the user mentions a shortcut for MVP, mark it as 'proposed' or 'verified' but perhaps add a 'constraint' or 'ambition' node for the future scale-up.` : '';

      const prompt = `Analyze the following NEW R&D conversation messages between a User and a System Architect.
      Update the existing architectural knowledge graph based on these new messages.
      
      ${strategyContext}
      
      CURRENT GRAPH:
      ${currentGraphText}
      
      NEW MESSAGES:
      ${conversationText}
      
      INSTRUCTIONS:
      1. ADD new knowledge nodes, decisions, or conflicts if introduced in the new messages.
      2. MODIFY existing items if the new messages change their context (e.g., update confidence, change status to 'verified' or 'discarded', add pros/cons).
      3. RETAIN existing items that are not affected by the new messages.
      4. For each node and decision, ensure 'sourceMessageId' points to the message ID that most directly supports it.
      5. Assign a confidence score (0-100).
      6. Link decisions to related knowledge node IDs (relatedNodeIds).
      
      Identify 'conflicts' where:
      - An ambition contradicts a constraint.
      - Two decisions are mutually exclusive.
      - A proposed implementation doesn't satisfy a use-case.
      
      Categorize nodes into: use-case, system-design, implementation, ambition, constraint.
      Assign nodes to layers: infrastructure, data, logic, interface, cross-cutting.
      Assign status: proposed, verified, discarded, ambitious.
      
      Return the COMPLETE updated knowledge graph matching the schema.`;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['use-case', 'system-design', 'implementation', 'ambition', 'constraint'] },
                    layer: { type: Type.STRING, enum: ['infrastructure', 'data', 'logic', 'interface', 'cross-cutting'] },
                    status: { type: Type.STRING, enum: ['proposed', 'verified', 'discarded', 'ambitious'] },
                    confidence: { type: Type.NUMBER },
                    sourceMessageId: { type: Type.STRING }
                  },
                  required: ['id', 'text', 'category', 'layer', 'status', 'confidence', 'sourceMessageId']
                }
              },
              decisions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                    cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                    layer: { type: Type.STRING, enum: ['infrastructure', 'data', 'logic', 'interface', 'cross-cutting'] },
                    confidence: { type: Type.NUMBER },
                    relatedNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    sourceMessageId: { type: Type.STRING }
                  },
                  required: ['id', 'title', 'summary', 'rationale', 'pros', 'cons', 'layer', 'confidence', 'relatedNodeIds', 'sourceMessageId']
                }
              },
              conflicts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    description: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                    nodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['id', 'description', 'severity', 'nodeIds']
                }
              }
            }
          }
        }
      });

      const jsonStr = response.text?.trim();
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        setGraph({
          nodes: parsed.nodes || [],
          decisions: parsed.decisions || [],
          conflicts: parsed.conflicts || []
        });
        lastSyncIndexRef.current = currentMessages.length;
      }
    } catch (error: any) {
      console.error("Synthesis failed:", error);
      const isQuotaError = error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota');
      if (isQuotaError) {
        setModelStatus(prev => ({ ...prev, [selectedModel]: 'quota_exceeded' }));
        setExtractionError(`Quota exceeded for ${MODELS.find(m => m.id === selectedModel)?.name}. Please switch models.`);
      } else {
        setExtractionError("Synthesis failed. Try manual sync.");
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleNewProject = () => {
    const name = prompt('Project Name:', `Project ${projects.length + 1}`);
    if (!name) return;

    const strategy = confirm('Optimize for MVP? (Cancel for Scale-first)') ? 'mvp' : 'scale';

    const newProject: Project = {
      id: Math.random().toString(36).substring(7),
      name,
      strategy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: '1',
          role: 'model',
          text: `Hello! I'm your R&D Architecture Assistant. We are starting a new project: ${name} with a ${strategy} strategy. What kind of system or feature are we designing today?`
        }
      ],
      graph: { nodes: [], decisions: [], conflicts: [] },
      tradeOffs: [],
      syncIndex: 0
    };

    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    setActiveTab('chat');
  };

  const handleUpdateProjectStrategy = (id: string, strategy: 'mvp' | 'scale' | 'hybrid') => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, strategy } : p));
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      alert("You must have at least one project.");
      return;
    }
    if (!confirm('Are you sure you want to delete this project?')) return;

    const newProjects = projects.filter(p => p.id !== id);
    setProjects(newProjects);
    if (currentProjectId === id) {
      setCurrentProjectId(newProjects[0].id);
    }
  };

  const handleRenameProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const newName = prompt('New Project Name:', project.name);
    if (!newName) return;

    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const handleExportProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re: any) => {
        try {
          const project = JSON.parse(re.target.result);
          if (!project.id || !project.messages) throw new Error('Invalid project file');
          
          // Ensure ID is unique
          project.id = Math.random().toString(36).substring(7);
          project.name = `${project.name} (Imported)`;
          
          setProjects(prev => [...prev, project]);
          setCurrentProjectId(project.id);
          alert('Project imported successfully!');
        } catch (err) {
          alert('Failed to import project: Invalid format');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg.text });
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text };
      const updatedMessages = [...newMessages, botMsg];
      setMessages(updatedMessages);
      
      // Trigger background extraction to update the report if autoSync is on
      if (autoSync) {
        synthesizeKnowledge(updatedMessages);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const isQuotaError = error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota');
      if (isQuotaError) {
        setModelStatus(prev => ({ ...prev, [selectedModel]: 'quota_exceeded' }));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `⚠️ Quota exceeded for ${MODELS.find(m => m.id === selectedModel)?.name}. Please select a different model from the top menu.` }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Sorry, I encountered an error processing that request." }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateTradeOff = async (topic: string) => {
    setIsExtracting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const currentProject = projects.find(p => p.id === currentProjectId);
      const strategy = currentProject?.strategy || 'mvp';

      const prompt = `Generate a side-by-side architectural trade-off comparison for the topic: "${topic}".
      Consider the current project strategy: ${strategy.toUpperCase()}.
      
      Return a JSON object matching this schema:
      {
        "topic": string,
        "optionA": { "name": string, "description": string, "pros": string[], "cons": string[], "cost": "low"|"medium"|"high", "complexity": "low"|"medium"|"high" },
        "optionB": { "name": string, "description": string, "pros": string[], "cons": string[], "cost": "low"|"medium"|"high", "complexity": "low"|"medium"|"high" },
        "recommendation": string,
        "strategyAlignment": string
      }`;

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const data = JSON.parse(response.text);
      const newTradeOff: TradeOff = {
        id: Math.random().toString(36).substring(7),
        ...data
      };

      setTradeOffs(prev => [newTradeOff, ...prev]);
      setActiveTab('matrix');
    } catch (error) {
      console.error("Failed to generate trade-off:", error);
      alert("Failed to generate trade-off. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExportADR = (decision: Decision) => {
    const adr = `# ADR-${decision.id.substring(0, 4)}: ${decision.title}

## Status
${decision.status.toUpperCase()}

## Date
${decision.date}

## Deciders
${decision.deciders}

## Context and Problem Statement
${decision.summary}

## Decision Outcome
${decision.rationale}

### Pros
${(decision.pros || []).map(p => `- ${p}`).join('\n')}

### Cons
${(decision.cons || []).map(c => `- ${c}`).join('\n')}

## Strategy Alignment
Confidence Score: ${decision.confidence}%
Layer: ${decision.layer.toUpperCase()}
`;

    const blob = new Blob([adr], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADR-${decision.id.substring(0, 4)}-${decision.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const timestamp = new Date().toLocaleString();
    // Generate Mermaid Diagram
    let mermaid = '```mermaid\ngraph TD\n';
    
    // Group nodes by layer
    const layers = [...new Set((graph.nodes || []).filter(n => n).map(n => n.layer))];
    layers.forEach(layer => {
      mermaid += `  subgraph ${(layer || 'unknown').toUpperCase()}\n`;
      (graph.nodes || []).filter(n => n && n.layer === layer).forEach(n => {
        mermaid += `    ${n.id}["${n.text.replace(/"/g, "'")}"]\n`;
      });
      mermaid += `  end\n`;
    });

    // Add decisions and links
    (graph.decisions || []).filter(d => d).forEach(d => {
      mermaid += `  ${d.id}{{"${(d.title || 'Untitled').replace(/"/g, "'")}"}}\n`;
      (d.relatedNodeIds || []).forEach(nodeId => {
        if ((graph.nodes || []).find(n => n && n.id === nodeId)) {
          mermaid += `  ${d.id} --> ${nodeId}\n`;
        }
      });
    });
    mermaid += '```\n';

    const md = `# Architecture Synthesis Report
Generated on: ${timestamp}

## Architecture Diagram
${mermaid}

## Decisions
${(graph.decisions || []).filter(d => d).map(d => `### ${d.title || 'Untitled'}
**Layer:** ${(d.layer || 'unknown').toUpperCase()}
**Rationale:** ${d.rationale || 'N/A'}

**Pros:**
${(d.pros || []).map(p => `- ${p}`).join('\n')}

**Cons:**
${(d.cons || []).map(c => `- ${c}`).join('\n')}

**Summary:**
${d.summary || 'N/A'}`).join('\n\n---\n\n')}

## Architectural Conflicts
${(graph.conflicts || []).length > 0 
  ? (graph.conflicts || []).filter(c => c).map(c => `- **[${(c.severity || 'low').toUpperCase()}]** ${c.description}`).join('\n')
  : "_No conflicts detected._"}

## Knowledge Map
${(graph.nodes || []).filter(n => n).map(n => `- **[${(n.category || 'unknown').toUpperCase()}]** [${(n.layer || 'unknown').toUpperCase()}] ${n.text} (_Status: ${n.status}_)`).join('\n')}

## Trade-off Analysis
${(tradeOffs || []).map(t => `### ${t.topic}
**Recommendation:** ${t.recommendation}

| Feature | ${t.optionA.name} | ${t.optionB.name} |
|---------|-------------------|-------------------|
| Cost | ${t.optionA.cost} | ${t.optionB.cost} |
| Complexity | ${t.optionA.complexity} | ${t.optionB.complexity} |
| Pros | ${t.optionA.pros.join(', ')} | ${t.optionB.pros.join(', ')} |
| Cons | ${t.optionA.cons.join(', ')} | ${t.optionB.cons.join(', ')} |`).join('\n\n')}`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const currentProject = projects.find(p => p.id === currentProjectId);
    const projectName = currentProject ? currentProject.name.toLowerCase().replace(/\s+/g, '-') : 'architecture';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-synthesis-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearSession = () => {
    if (confirm('Are you sure you want to clear the current project? This will reset all messages and the knowledge map.')) {
      setMessages([
        {
          id: '1',
          role: 'model',
          text: "Hello! I'm your R&D Architecture Assistant. What kind of system or feature are we designing today?"
        }
      ]);
      setGraph({ nodes: [], decisions: [], conflicts: [] });
      lastSyncIndexRef.current = 0;
      
      // Re-initialize chat session
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      chatRef.current = ai.chats.create({
        model: selectedModel,
        config: {
          systemInstruction: "You are an expert System Architect and R&D assistant. Your goal is to help the user synthesize complex system designs. Categorize insights into layers: Infrastructure, Data, Logic, Interface, and Cross-cutting. Distinguish between immediate implementation constraints and long-term ambitions. Ask clarifying questions to verify assumptions. Be technical, concise, and analytical."
        }
      });
    }
  };

  const handleDeleteNode = (id: string) => {
    if (!confirm('Delete this insight?')) return;
    setGraph(prev => ({
      ...prev,
      nodes: (prev.nodes || []).filter(n => n && n.id !== id),
      decisions: (prev.decisions || []).filter(d => d).map(d => ({
        ...d,
        relatedNodeIds: (d.relatedNodeIds || []).filter(nid => nid !== id)
      }))
    }));
  };

  const handleDeleteDecision = (id: string) => {
    if (!confirm('Delete this decision?')) return;
    setGraph(prev => ({
      ...prev,
      decisions: (prev.decisions || []).filter(d => d && d.id !== id)
    }));
  };

  const handleSaveNode = () => {
    if (!editingNode) return;
    setGraph(prev => ({
      ...prev,
      nodes: (prev.nodes || []).map(n => n && n.id === editingNode.id ? editingNode : n)
    }));
    setEditingNode(null);
  };

  const handleSaveDecision = () => {
    if (!editingDecision) return;
    setGraph(prev => ({
      ...prev,
      decisions: (prev.decisions || []).map(d => d && d.id === editingDecision.id ? editingDecision : d)
    }));
    setEditingDecision(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  return (
    <>
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-[#0A0A0A] text-gray-200 overflow-hidden font-sans">
      
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-16 border-r border-[#262626] bg-[#050505] items-center py-6 gap-6 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-[#00E599]" />
        </div>
        
        <button 
          onClick={() => setActiveTab('chat')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'chat' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Chat Sandbox"
        >
          <MessageSquare className="w-5 h-5" />
          {activeTab === 'chat' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('map')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'map' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Knowledge Map"
        >
          <Layers className="w-5 h-5" />
          {activeTab === 'map' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('decisions')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'decisions' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Decision Ledger (ADR)"
        >
          <ListChecks className="w-5 h-5" />
          {activeTab === 'decisions' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('matrix')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'matrix' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Trade-off Matrix"
        >
          <Activity className="w-5 h-5" />
          {activeTab === 'matrix' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <div className="mt-auto flex flex-col gap-4">
          <button 
            onClick={handleImportProject}
            className="p-3 rounded-xl text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Import Project"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={handleClearSession}
            className="p-3 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear Current Project"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Projects Sidebar (Desktop) */}
      <div className="hidden lg:flex flex-col w-64 border-r border-[#262626] bg-[#0A0A0A] shrink-0">
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#262626]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Projects</h2>
          <button 
            onClick={handleNewProject}
            className="p-1.5 rounded-md hover:bg-[#1A1A1A] text-[#00E599] transition-colors"
            title="New Project"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {projects.map(project => (
            <div 
              key={project.id}
              onClick={() => setCurrentProjectId(project.id)}
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
                    onClick={(e) => handleRenameProject(project.id, e)}
                    className="p-1 hover:text-[#00E599]"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => handleExportProject(project.id, e)}
                    className="p-1 hover:text-blue-400"
                    title="Export"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteProject(project.id, e)}
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
                  onChange={(e) => handleUpdateProjectStrategy(project.id, e.target.value as any)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent text-[9px] border border-white/10 rounded px-1 hover:border-[#00E599]/50 transition-colors"
                >
                  <option value="mvp" className="bg-[#0A0A0A]">MVP</option>
                  <option value="scale" className="bg-[#0A0A0A]">SCALE</option>
                  <option value="hybrid" className="bg-[#0A0A0A]">HYBRID</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex px-2 py-2 gap-1 overflow-x-auto border-b border-[#262626] bg-[#141414] shrink-0">
        <button onClick={() => setActiveTab('chat')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'chat' ? "bg-[#262626] text-white" : "text-gray-500")}>Chat</button>
        <button onClick={() => setActiveTab('map')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'map' ? "bg-[#262626] text-white" : "text-gray-500")}>Map</button>
        <button onClick={() => setActiveTab('decisions')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'decisions' ? "bg-[#262626] text-white" : "text-gray-500")}>ADR</button>
        <button onClick={() => setActiveTab('matrix')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'matrix' ? "bg-[#262626] text-white" : "text-gray-500")}>Matrix</button>
      </div>

      {/* LEFT PANE: Chat Sandbox */}
      <div className={cn(
        "w-full flex-col border-r border-[#262626] bg-[#0A0A0A] relative z-10 shadow-2xl h-full min-h-0",
        activeTab === 'chat' ? "flex flex-1" : "hidden"
      )}>
        {/* Header */}
        <div className="h-16 flex items-center px-6 glass-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#00E599]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-white text-sm">ArchBot</h1>
                <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">v2.0</span>
              </div>
              <select 
                value={currentProjectId || ''} 
                onChange={(e) => setCurrentProjectId(e.target.value)}
                className="lg:hidden bg-transparent text-[10px] text-[#00E599] font-mono focus:outline-none cursor-pointer hover:underline"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0A0A0A] text-white">{p.name}</option>
                ))}
              </select>
              <p className="hidden lg:block text-[10px] text-[#00E599] font-mono truncate max-w-[120px]">
                {projects.find(p => p.id === currentProjectId)?.name}
              </p>
            </div>
          </div>
          
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={cn(
                  "appearance-none bg-[#141414] border text-[10px] font-mono rounded px-3 py-1.5 pr-8 focus:outline-none transition-colors",
                  modelStatus[selectedModel] === 'quota_exceeded' 
                    ? "border-amber-500/50 text-amber-500 hover:border-amber-500/70 focus:border-amber-500" 
                    : "border-[#262626] text-gray-300 hover:border-[#333] focus:border-[#00E599]/50"
                )}
              >
                {MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {modelStatus[model.id] === 'quota_exceeded' ? '⚠️' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            <button
              onClick={handleClearSession}
              className="text-[10px] font-mono text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
            >
              CLEAR SESSION
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                id={`msg-${msg.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  backgroundColor: highlightedMessageId === msg.id ? 'rgba(0, 229, 153, 0.1)' : 'transparent'
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "flex gap-4 max-w-[90%] p-2 rounded-xl transition-colors",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                  msg.role === 'user' ? "bg-[#1A1A1A] border border-[#333]" : "bg-[#00E599]/10 border border-[#00E599]/20"
                )}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-gray-400" /> : <Bot className="w-4 h-4 text-[#00E599]" />}
                </div>
                <div className={cn(
                  "px-5 py-4 rounded-2xl text-[13px] leading-relaxed shadow-sm relative group",
                  msg.role === 'user' 
                    ? "bg-[#141414] border border-[#262626] text-gray-200 rounded-tr-sm" 
                    : "bg-[#111] border border-[#1A1A1A] text-gray-300 rounded-tl-sm"
                )}>
                  <button 
                    onClick={() => copyToClipboard(msg.text, msg.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-[#0A0A0A]/50 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#00E599]"
                    title="Copy to clipboard"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                  {msg.role === 'model' ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-[#00E599]" />
              </div>
              <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#262626] bg-[#0A0A0A] shrink-0">
          <div className="relative flex items-end bg-[#141414] border border-[#262626] rounded-xl focus-within:border-[#00E599]/50 focus-within:ring-1 focus-within:ring-[#00E599]/50 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your system idea, constraints, or ask a question..."
              className="w-full max-h-48 min-h-[56px] bg-transparent text-sm text-gray-200 placeholder-gray-600 p-4 pr-12 resize-none focus:outline-none"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-[#00E599] text-black hover:bg-[#00c282] disabled:opacity-50 disabled:hover:bg-[#00E599] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-gray-600 font-mono">Shift + Enter for new line</p>
              <button 
                onClick={() => setAutoSync(!autoSync)}
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                  autoSync ? "bg-[#00E599]/10 border-[#00E599]/30 text-[#00E599]" : "bg-gray-800 border-gray-700 text-gray-500"
                )}
              >
                AUTO-SYNC: {autoSync ? 'ON' : 'OFF'}
              </button>
            </div>
            {isExtracting && (
              <p className="text-[11px] text-[#00E599] font-mono flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Updating...
              </p>
            )}
            {extractionError && !isExtracting && (
              <p className="text-[11px] text-red-400 font-mono">
                Quota hit
              </p>
            )}
          </div>
        </div>
      </div>

      {/* CENTER PANE: Knowledge Map */}
      <div className={cn(
        "flex-col w-full border-r border-[#262626] bg-[#0A0A0A] h-full min-h-0",
        activeTab === 'map' ? "flex flex-1" : "hidden"
      )}>
        <div className="h-16 flex items-center justify-between px-4 sm:px-6 glass-header shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-medium text-white">Knowledge Map</h2>
            </div>
            {/* Health Indicator */}
            <div className="flex items-center gap-1.5 bg-[#141414] px-2 py-1 rounded border border-[#262626]">
              {LAYERS.map(l => {
                const count = graph.nodes.filter(n => n && n.layer === l.id).length;
                return (
                  <div 
                    key={l.id} 
                    className={cn(
                      "w-1.5 h-3 rounded-sm transition-colors",
                      count > 3 ? l.color.replace('text', 'bg') :
                      count > 0 ? l.color.replace('text', 'bg').replace('400', '900') :
                      "bg-gray-800"
                    )}
                    title={`${l.label}: ${count} insights`}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center transition-colors mr-1",
                viewMode === 'graph' ? "bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/30" : "bg-gray-800 text-gray-500"
              )}
              title="TOGGLE GRAPH VIEW"
            >
              <Share2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setVisionMode(!visionMode)}
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center transition-colors mr-2",
                visionMode ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-gray-800 text-gray-500"
              )}
              title="VISION MODE (AMBITIONS)"
            >
              <Sparkles className="w-3 h-3" />
            </button>
            {['all', ...LAYERS.map(l => l.id)].map((l) => (
              <button
                key={l}
                onClick={() => setActiveLayer(l as any)}
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center transition-colors",
                  activeLayer === l ? "bg-[#1A1A1A] text-[#00E599]" : "text-gray-600 hover:text-gray-400"
                )}
                title={l.toUpperCase()}
              >
                {l === 'all' ? <Activity className="w-3 h-3" /> : <div className={cn("w-1.5 h-1.5 rounded-full", LAYERS.find(layer => layer.id === l)?.color.replace('text', 'bg'))} />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col">
          {/* Conflicts Alert */}
          {(graph.conflicts || []).length > 0 && (
            <div className="px-2">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Architectural Conflicts Detected</span>
                </div>
                <div className="space-y-1.5">
                  {(graph.conflicts || []).map(conflict => (
                    <div key={conflict.id} className="text-[11px] text-gray-400 flex gap-2">
                      <span className={cn(
                        "shrink-0 w-1 h-1 rounded-full mt-1.5",
                        conflict.severity === 'high' ? "bg-red-500" : "bg-amber-500"
                      )} />
                      {conflict.description}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'graph' ? (
            <div className="flex-1 min-h-[300px]">
              <KnowledgeGraphView 
                nodes={graph.nodes} 
                decisions={graph.decisions} 
                onNodeClick={scrollToMessage} 
              />
            </div>
          ) : (
            LAYERS.filter(l => activeLayer === 'all' || activeLayer === l.id).map(layer => {
              const layerNodes = graph.nodes.filter(n => {
                if (!n) return false;
                const layerMatch = n.layer === layer.id;
                const visionMatch = visionMode ? n.status === 'ambitious' : n.status !== 'ambitious';
                return layerMatch && visionMatch;
              });
              if (layerNodes.length === 0 && activeLayer !== layer.id) return null;

              return (
                <div key={layer.id} className="space-y-3">
                  <div className="flex items-center gap-2 px-2">
                    <layer.icon className={cn("w-3.5 h-3.5", layer.color)} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{layer.label}</span>
                    <div className="flex-1 h-[1px] bg-[#1A1A1A]" />
                  </div>
                  <div className="space-y-2">
                    {layerNodes.length > 0 ? layerNodes.map(node => {
                      const CatIcon = (CATEGORIES as any)[node.category]?.icon || Target;
                      return (
                        <motion.div
                          key={node.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => node.sourceMessageId && scrollToMessage(node.sourceMessageId)}
                          className={cn(
                            "group relative p-4 tech-card cursor-pointer",
                            node.status === 'ambitious' && "border-dashed border-purple-500/30 bg-purple-500/5"
                          )}
                        >
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#111] pl-2 rounded-bl-lg z-10">
                            <button onClick={(e) => { e.stopPropagation(); setEditingNode(node); }} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-500 hover:text-blue-400 transition-colors" title="Edit insight"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-500 hover:text-red-400 transition-colors" title="Delete insight"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "mt-0.5 p-2 rounded-xl bg-[#141414] border border-[#262626] text-gray-500 group-hover:text-gray-300 transition-colors",
                              node.status === 'ambitious' && "text-purple-400 border-purple-500/20"
                            )}>
                              <CatIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-gray-300 leading-snug font-medium">{node.text}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded",
                                    node.status === 'verified' ? "bg-emerald-500/10 text-emerald-500" :
                                    node.status === 'ambitious' ? "bg-purple-500/10 text-purple-400" :
                                    node.status === 'discarded' ? "bg-red-500/10 text-red-400" :
                                    "bg-gray-800 text-gray-500"
                                  )}>
                                    {node.status}
                                  </span>
                                  <span className="text-[9px] text-gray-600 font-mono uppercase tracking-tight">{node.category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-14 h-1 bg-gray-900 rounded-full overflow-hidden border border-[#1A1A1A]">
                                    <div 
                                      className={cn(
                                        "h-full transition-all duration-700",
                                        node.confidence > 80 ? "bg-emerald-500" :
                                        node.confidence > 50 ? "bg-amber-500" :
                                        "bg-red-500"
                                      )}
                                      style={{ width: `${node.confidence}%` }}
                                    />
                                  </div>
                                  <span className="text-[8px] font-mono text-gray-600">{node.confidence}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }) : (
                      <div className="py-4 px-2 border border-dashed border-[#1A1A1A] rounded-xl bg-[#111]/20 flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] text-gray-700 font-mono uppercase tracking-widest">Awaiting Data</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: Decision Ledger (ADR) */}
      <div className={cn(
        "flex-col bg-[#0A0A0A] w-full h-full min-h-0",
        activeTab === 'decisions' ? "flex flex-1" : "hidden"
      )}>
        <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">ADR Manager</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => synthesizeKnowledge(messages, 0, true)}
              disabled={isExtracting}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                isExtracting ? "bg-gray-800 border-gray-700 text-gray-500" : "border-[#262626] text-gray-300 hover:bg-[#141414] hover:text-white"
              )}
            >
              <Sparkles className={cn("w-3.5 h-3.5", isExtracting && "animate-pulse")} />
              {isExtracting ? 'Synthesizing...' : 'Synthesize'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#262626] text-xs font-medium text-gray-300 hover:bg-[#141414] hover:text-white transition-colors"
              title="Export Full Report"
            >
              <FileText className="w-3.5 h-3.5" />
              Report
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {(graph.decisions || []).length > 0 ? (
              (graph.decisions || []).map((decision, idx) => {
                if (!decision) return null;
                const layer = LAYERS.find(l => l.id === decision.layer);
                return (
                  <motion.div
                    key={decision.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="tech-card overflow-hidden group border-[#262626]"
                  >
                    <div className="p-6 space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-500">ADR-{decision.id.substring(0, 4).toUpperCase()}</span>
                            <span className={cn(
                              "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded",
                              decision.status === 'accepted' ? "bg-emerald-500/10 text-emerald-500" :
                              decision.status === 'proposed' ? "bg-blue-500/10 text-blue-400" :
                              "bg-red-500/10 text-red-400"
                            )}>
                              {decision.status || 'proposed'}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white">{decision.title}</h3>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleExportADR(decision)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-emerald-400 transition-colors" title="Export ADR"><Download className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingDecision(decision)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-blue-400 transition-colors" title="Edit ADR"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteDecision(decision.id)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-red-400 transition-colors" title="Delete ADR"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
                        <div className="p-3 rounded-lg bg-[#050505] border border-[#1A1A1A]">
                          <p className="text-gray-600 uppercase mb-1">Date</p>
                          <p className="text-gray-300">{decision.date || new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[#050505] border border-[#1A1A1A]">
                          <p className="text-gray-600 uppercase mb-1">Deciders</p>
                          <p className="text-gray-300 truncate">{decision.deciders || 'Architect'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Context</p>
                          <p className="text-[13px] text-gray-400 leading-relaxed">{decision.summary}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Decision Outcome</p>
                          <p className="text-[13px] text-gray-300 leading-relaxed">{decision.rationale}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase text-emerald-500/70 tracking-widest">Consequences (Pros)</p>
                          <ul className="space-y-1">
                            {(decision.pros || []).map((p, i) => (
                              <li key={i} className="text-[12px] text-gray-400 flex items-start gap-2">
                                <Check className="w-3 h-3 text-emerald-500 mt-1 shrink-0" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase text-red-500/70 tracking-widest">Consequences (Cons)</p>
                          <ul className="space-y-1">
                            {(decision.cons || []).map((c, i) => (
                              <li key={i} className="text-[12px] text-gray-400 flex items-start gap-2">
                                <X className="w-3 h-3 text-red-500 mt-1 shrink-0" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[#1A1A1A] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn("text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border", layer?.color.replace('text', 'border') || 'border-gray-800')}>
                            {decision.layer}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-gray-900 rounded-full overflow-hidden">
                              <div className={cn("h-full", decision.confidence > 80 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${decision.confidence}%` }} />
                            </div>
                            <span className="text-[9px] font-mono text-gray-600">{decision.confidence}% Confidence</span>
                          </div>
                        </div>
                        {decision.sourceMessageId && (
                          <button onClick={() => scrollToMessage(decision.sourceMessageId!)} className="text-[10px] font-mono text-gray-600 hover:text-[#00E599] flex items-center gap-1 transition-colors">
                            <Link2 className="w-3 h-3" />
                            Source
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center border border-dashed border-[#262626] rounded-3xl bg-[#111]/30 p-10">
                <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#262626] flex items-center justify-center mb-6 shadow-inner">
                  <Target className="w-8 h-8 text-gray-700" />
                </div>
                <h3 className="text-white font-medium mb-2 text-lg">Awaiting Synthesis</h3>
                <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                  As your architectural conversation evolves, ArchBot will distill insights into finalized decisions and trade-offs here.
                </p>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-mono text-gray-700 uppercase tracking-widest">
                  <Activity className="w-3 h-3" />
                  <span>Real-time analysis active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Trade-off Matrix */}
      <div className={cn(
        "flex-col bg-[#0A0A0A] w-full h-full min-h-0",
        activeTab === 'matrix' ? "flex flex-1" : "hidden"
      )}>
        <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Trade-off Matrix</h2>
          </div>
          <button
            onClick={() => {
              const topic = prompt('What architectural choice would you like to compare? (e.g., "SQL vs NoSQL", "Serverless vs K8s")');
              if (topic) handleGenerateTradeOff(topic);
            }}
            disabled={isExtracting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00E599] text-black text-xs font-bold hover:bg-[#00CC88] transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            New Comparison
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-12">
            {tradeOffs.length > 0 ? (
              tradeOffs.map((matrix, idx) => (
                <motion.div
                  key={matrix.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      <span className="text-gray-600 text-sm font-mono">0{tradeOffs.length - idx}</span>
                      {matrix.topic}
                    </h3>
                    <button 
                      onClick={() => setTradeOffs(prev => prev.filter(t => t.id !== matrix.id))}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1A1A1A] border border-[#1A1A1A] rounded-2xl overflow-hidden shadow-2xl">
                    {/* Option A */}
                    <div className="bg-[#0D0D0D] p-8 space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{matrix.optionA.name}</h4>
                          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Option A</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">{matrix.optionA.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-[#050505] border border-[#1A1A1A]">
                          <p className="text-[9px] text-gray-600 uppercase mb-1">Cost</p>
                          <p className={cn(
                            "text-xs font-bold capitalize",
                            matrix.optionA.cost === 'low' ? "text-emerald-400" : matrix.optionA.cost === 'medium' ? "text-amber-400" : "text-red-400"
                          )}>{matrix.optionA.cost}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[#050505] border border-[#1A1A1A]">
                          <p className="text-[9px] text-gray-600 uppercase mb-1">Complexity</p>
                          <p className={cn(
                            "text-xs font-bold capitalize",
                            matrix.optionA.complexity === 'low' ? "text-emerald-400" : matrix.optionA.complexity === 'medium' ? "text-amber-400" : "text-red-400"
                          )}>{matrix.optionA.complexity}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Pros</p>
                          <ul className="space-y-2">
                            {matrix.optionA.pros.map((p, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest">Cons</p>
                          <ul className="space-y-2">
                            {matrix.optionA.cons.map((c, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <X className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Option B */}
                    <div className="bg-[#0D0D0D] p-8 space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{matrix.optionB.name}</h4>
                          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Option B</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">{matrix.optionB.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-[#050505] border border-[#1A1A1A]">
                          <p className="text-[9px] text-gray-600 uppercase mb-1">Cost</p>
                          <p className={cn(
                            "text-xs font-bold capitalize",
                            matrix.optionB.cost === 'low' ? "text-emerald-400" : matrix.optionB.cost === 'medium' ? "text-amber-400" : "text-red-400"
                          )}>{matrix.optionB.cost}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[#050505] border border-[#1A1A1A]">
                          <p className="text-[9px] text-gray-600 uppercase mb-1">Complexity</p>
                          <p className={cn(
                            "text-xs font-bold capitalize",
                            matrix.optionB.complexity === 'low' ? "text-emerald-400" : matrix.optionB.complexity === 'medium' ? "text-amber-400" : "text-red-400"
                          )}>{matrix.optionB.complexity}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Pros</p>
                          <ul className="space-y-2">
                            {matrix.optionB.pros.map((p, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest">Cons</p>
                          <ul className="space-y-2">
                            {matrix.optionB.cons.map((c, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                <X className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#00E599]/5 border border-[#00E599]/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#00E599]" />
                      <p className="text-xs font-bold text-[#00E599] uppercase tracking-widest">Architect Recommendation</p>
                    </div>
                    <p className="text-sm text-white leading-relaxed">{matrix.recommendation}</p>
                    <div className="pt-2 flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                      <Target className="w-3 h-3" />
                      STRATEGY ALIGNMENT: {matrix.strategyAlignment}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <Activity className="w-8 h-8 text-gray-700" />
                </div>
                <div>
                  <h3 className="text-white font-medium">No comparisons yet</h3>
                  <p className="text-sm text-gray-600 max-w-xs mx-auto mt-1">Use the "New Comparison" button to evaluate architectural options side-by-side.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Edit Node Modal */}
    <AnimatePresence>
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#111] border border-[#262626] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">Edit Insight</h3>
              <button onClick={() => setEditingNode(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Text</label>
                <textarea value={editingNode.text} onChange={e => setEditingNode({...editingNode, text: e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50 min-h-[100px]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Status</label>
                  <select value={editingNode.status} onChange={e => setEditingNode({...editingNode, status: e.target.value as KnowledgeStatus})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50">
                    <option value="proposed">Proposed</option>
                    <option value="verified">Verified</option>
                    <option value="ambitious">Ambitious</option>
                    <option value="discarded">Discarded</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Confidence ({editingNode.confidence}%)</label>
                  <input type="range" min="0" max="100" value={editingNode.confidence} onChange={e => setEditingNode({...editingNode, confidence: parseInt(e.target.value)})} className="w-full accent-[#00E599] mt-2" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingNode(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSaveNode} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00E599] text-black hover:bg-[#00c282] transition-colors">Save Changes</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Edit Decision Modal */}
    <AnimatePresence>
      {editingDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#111] border border-[#262626] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">Edit Decision</h3>
              <button onClick={() => setEditingDecision(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Status</label>
                  <select 
                    value={editingDecision.status || 'proposed'} 
                    onChange={e => setEditingDecision({...editingDecision, status: e.target.value as ADRStatus})}
                    className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50"
                  >
                    <option value="proposed">Proposed</option>
                    <option value="accepted">Accepted</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Date</label>
                  <input 
                    type="date"
                    value={editingDecision.date || new Date().toISOString().split('T')[0]} 
                    onChange={e => setEditingDecision({...editingDecision, date: e.target.value})}
                    className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Title</label>
                <input value={editingDecision.title} onChange={e => setEditingDecision({...editingDecision, title: e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Deciders</label>
                <input value={editingDecision.deciders || ''} onChange={e => setEditingDecision({...editingDecision, deciders: e.target.value})} placeholder="e.g. Architect, Lead Dev" className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Context (Summary)</label>
                <textarea value={editingDecision.summary} onChange={e => setEditingDecision({...editingDecision, summary: e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50 min-h-[80px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Decision Outcome (Rationale)</label>
                <textarea value={editingDecision.rationale} onChange={e => setEditingDecision({...editingDecision, rationale: e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50 min-h-[80px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Confidence ({editingDecision.confidence}%)</label>
                <input type="range" min="0" max="100" value={editingDecision.confidence} onChange={e => setEditingDecision({...editingDecision, confidence: parseInt(e.target.value)})} className="w-full accent-[#00E599]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1A1A1A]">
              <button onClick={() => setEditingDecision(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSaveDecision} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00E599] text-black hover:bg-[#00c282] transition-colors">Save Changes</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
  );
}
