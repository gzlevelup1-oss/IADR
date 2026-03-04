/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, FileText, Server, AlertTriangle, ListChecks, Download, Upload, Loader2, Sparkles, MessageSquare, Layers, Target, Zap, Shield, Database, Layout, Link2, ChevronRight, Activity, Share2, Edit2, Trash2, X, Copy, Check, Plus, RefreshCw, Settings, FileJson, Split, Paperclip, DollarSign, BookOpen, Code, ShieldCheck, Cpu, FileCheck, BarChart3, Gauge } from 'lucide-react';

const DESIGN_PATTERNS = [
  { id: 'microservices', title: 'Microservices', description: 'Decompose system into small, independent services communicating over network.', pros: ['Scalability', 'Independent deployment'], cons: ['Complexity', 'Network latency'] },
  { id: 'event-driven', title: 'Event-Driven', description: 'Asynchronous communication through events and message brokers.', pros: ['Loose coupling', 'Scalability'], cons: ['Eventual consistency', 'Debugging complexity'] },
  { id: 'layered', title: 'Layered Architecture', description: 'Organize system into horizontal layers with strict dependencies.', pros: ['Separation of concerns', 'Maintainability'], cons: ['Performance overhead', 'Rigidity'] },
  { id: 'serverless', title: 'Serverless', description: 'Event-driven compute without managing servers.', pros: ['Zero maintenance', 'Auto-scaling'], cons: ['Cold starts', 'Vendor lock-in'] },
  { id: 'hexagonal', title: 'Hexagonal (Ports & Adapters)', description: 'Decouple core logic from external systems using interfaces.', pros: ['Testability', 'Flexibility'], cons: ['Boilerplate', 'Indirection'] },
];

import { motion, AnimatePresence } from 'motion/react';
import { KnowledgeGraphView } from './components/KnowledgeGraph';
import { Mermaid } from './components/Mermaid';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = { 
  id: string; 
  role: 'user' | 'model'; 
  text: string;
  comparison?: { model: string; text: string }[];
};

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
  supersedes?: string;
  amends?: string;
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
  executiveSummary?: string;
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
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry(
  ai: any,
  params: any,
  maxRetries = 3,
  initialDelay = 2000
) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      
      if (isQuotaError && i < maxRetries - 1) {
        const backoff = initialDelay * Math.pow(2, i);
        console.warn(`Quota exceeded. Retrying in ${backoff}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(backoff);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

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
  const [activeTab, setActiveTab] = useState<'chat' | 'map' | 'decisions' | 'matrix' | 'diagram' | 'cost' | 'patterns' | 'iac' | 'security' | 'skeletons' | 'compliance' | 'scorecard' | 'performance'>('chat');
  const [diagramType, setDiagramType] = useState<'layers' | 'lineage' | 'sequence'>('layers');
  const [modelComparisonMode, setModelComparisonMode] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string, title: string, description: string, impact: 'high' | 'medium' | 'low' }[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [costEstimates, setCostEstimates] = useState<{ provider: string, monthlyTotal: number, breakdown: { service: string, cost: number, rationale: string }[] } | null>(null);
  const [isEstimatingCosts, setIsEstimatingCosts] = useState(false);
  const [iacTemplate, setIacTemplate] = useState<{ language: string, code: string, explanation: string } | null>(null);
  const [isGeneratingIaC, setIsGeneratingIaC] = useState(false);
  const [securityAudit, setSecurityAudit] = useState<{ vulnerabilities: { title: string, severity: 'critical' | 'high' | 'medium' | 'low', description: string, mitigation: string }[], score: number } | null>(null);
  const [isAuditingSecurity, setIsAuditingSecurity] = useState(false);
  const [serviceSkeletons, setServiceSkeletons] = useState<{ serviceName: string, language: string, files: { path: string, content: string }[] }[]>([]);
  const [isGeneratingSkeletons, setIsGeneratingSkeletons] = useState(false);
  const [complianceReport, setComplianceReport] = useState<{ standard: string, score: number, findings: { requirement: string, status: 'compliant' | 'non-compliant' | 'partial', gap: string, recommendation: string }[] } | null>(null);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
  const [healthScorecard, setHealthScorecard] = useState<{ overall: number, security: number, cost: number, compliance: number, performance: number, summary: string } | null>(null);
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
  const [performanceEstimate, setPerformanceEstimate] = useState<{ tps: number, latency: string, bottlenecks: string[], scalability: string } | null>(null);
  const [isEstimatingPerformance, setIsEstimatingPerformance] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [graph, setGraph] = useState<KnowledgeGraph>({ nodes: [], decisions: [], conflicts: [] });
  const [tradeOffs, setTradeOffs] = useState<TradeOff[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<string | undefined>();
  const lastSyncIndexRef = useRef<number>(0);

  // Load current project data
  useEffect(() => {
    const project = projects.find(p => p.id === currentProjectId);
    if (project) {
      setMessages(project.messages);
      setGraph(project.graph);
      setTradeOffs(project.tradeOffs || []);
      setExecutiveSummary(project.executiveSummary);
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
        executiveSummary: undefined,
        syncIndex: 0
      };
      setProjects([initialProject]);
      setCurrentProjectId(initialProject.id);
    }
  }, [currentProjectId]);

  // Save current project when data changes (Debounced)
  useEffect(() => {
    if (!currentProjectId) return;
    
    const timeoutId = setTimeout(() => {
      setProjects(prev => {
        const updated = prev.map(p => {
          if (p.id === currentProjectId) {
            return {
              ...p,
              messages,
              graph,
              tradeOffs,
              executiveSummary,
              syncIndex: lastSyncIndexRef.current,
              updatedAt: Date.now()
            };
          }
          return p;
        });
        
        // Persist to localStorage only if changed
        const currentProject = updated.find(p => p.id === currentProjectId);
        const prevProject = prev.find(p => p.id === currentProjectId);
        
        if (JSON.stringify(currentProject) !== JSON.stringify(prevProject)) {
          localStorage.setItem('archbot_projects', JSON.stringify(updated));
        }
        
        return updated;
      });
    }, 1000); // 1s debounce

    return () => clearTimeout(timeoutId);
  }, [messages, graph, tradeOffs, executiveSummary, currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem('archbot_current_project_id', currentProjectId);
    }
  }, [currentProjectId]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectStrategy, setNewProjectStrategy] = useState<'mvp' | 'scale' | 'hybrid'>('mvp');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingGaps, setIsAnalyzingGaps] = useState(false);
  const [isGeneratingSRS, setIsGeneratingSRS] = useState(false);
  const [isGeneratingClarity, setIsGeneratingClarity] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [visionMode, setVisionMode] = useState(false); // Vision Mode Toggle
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [adrViewMode, setAdrViewMode] = useState<'list' | 'lineage'>('list');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<KnowledgeLayer | 'all'>('all');
  const [showProjectSettings, setShowProjectSettings] = useState<string | null>(null);
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
        Ask clarifying questions to verify assumptions. Be technical, concise, and analytical.
        
        When describing system flows or architectures, you are encouraged to use Mermaid diagrams. 
        Use the following syntax for Mermaid code blocks:
        \`\`\`mermaid
        graph TD
          A --> B
        \`\`\`
        The system will automatically render these diagrams for the user.`
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

      // Check for paid key if needed
      const hasKey = await window.aistudio.hasSelectedApiKey();
      const apiKey = hasKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
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

      const response = await callGeminiWithRetry(ai, {
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

  const handleAnalyzeGaps = async () => {
    if (!currentProjectId) return;
    setIsAnalyzingGaps(true);
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      const apiKey = hasKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (!currentProject) return;

      const prompt = `
        You are an expert Software Architect. Review the current state of the architecture and identify any gaps, risks, or missing components based on the project strategy (${currentProject.strategy}).

        Current Knowledge Graph:
        ${JSON.stringify(currentProject.graph, null, 2)}

        Current Trade-offs:
        ${JSON.stringify(currentProject.tradeOffs, null, 2)}

        Provide a concise, structured Markdown report highlighting:
        1. Critical Missing Decisions (ADRs needed)
        2. Unaddressed Risks or Constraints
        3. Architectural Inconsistencies
        4. Recommendations for Next Steps

        Keep it professional, actionable, and directly related to the provided data. Do not include a generic introduction, start directly with the report.
      `;

      const response = await callGeminiWithRetry(ai, {
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const report = response.text;

      if (!report) throw new Error("No report generated");

      const newMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'model',
        text: `**Architecture Gaps Analysis**\n\n${report}`
      };

      setMessages(prev => [...prev, newMessage]);
      setActiveTab('chat');
      
      setProjects(prev => prev.map(p => 
        p.id === currentProjectId 
          ? { ...p, messages: [...p.messages, newMessage], updatedAt: Date.now() }
          : p
      ));

    } catch (error) {
      console.error("Failed to analyze gaps:", error);
      alert("Failed to analyze gaps. Please try again.");
    } finally {
      setIsAnalyzingGaps(false);
    }
  };

  const generateExecutiveSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      const apiKey = hasKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
      const currentProject = projects.find(p => p.id === currentProjectId);
      const strategy = currentProject?.strategy || 'mvp';

      const prompt = `Generate a high-level "Executive Summary" for this architecture project.
      
      Project Strategy: ${strategy.toUpperCase()}
      
      Current Knowledge Map:
      ${JSON.stringify(graph.nodes.map(n => n.text))}
      
      Key Decisions:
      ${JSON.stringify(graph.decisions.map(d => d.title))}
      
      Trade-offs:
      ${JSON.stringify(tradeOffs.map(t => t.topic))}
      
      The summary should explain the "Architecture Story":
      1. Why we chose this specific direction.
      2. How it supports the business goals (MVP speed vs Scale robustness).
      3. Key technical pillars.
      
      Keep it professional, concise (2-3 paragraphs), and impactful. Use Markdown formatting.`;

      const response = await callGeminiWithRetry(ai, {
        model: selectedModel,
        contents: prompt,
      });

      const summary = response.text?.trim();
      if (summary) {
        setExecutiveSummary(summary);
      }
    } catch (error) {
      console.error("Failed to generate summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateSRS = async () => {
    setIsGeneratingSRS(true);
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      const apiKey = hasKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
      const currentProject = projects.find(p => p.id === currentProjectId);
      const strategy = currentProject?.strategy || 'mvp';

      const prompt = `Generate a comprehensive Software Requirements Specification (SRS) report for this architecture project.
      
      Project Name: ${currentProject?.name || 'Untitled Project'}
      Project Strategy: ${strategy.toUpperCase()}
      
      Current Knowledge Map:
      ${JSON.stringify(graph.nodes)}
      
      Key Decisions (ADRs):
      ${JSON.stringify(graph.decisions)}
      
      Trade-offs:
      ${JSON.stringify(tradeOffs)}
      
      Conflicts:
      ${JSON.stringify(graph.conflicts)}
      
      The SRS should follow a standard structure:
      1. Introduction (Purpose, Scope)
      2. Overall Description (Product Perspective, User Classes, Operating Environment)
      3. System Features & Requirements (Functional Requirements derived from Use Cases)
      4. Non-Functional Requirements (Performance, Security, Reliability derived from Constraints/Ambitions)
      5. System Architecture (High-level overview based on Decisions and Layers)
      
      Keep it professional, detailed, and well-structured. Use Markdown formatting.`;

      const response = await callGeminiWithRetry(ai, {
        model: 'gemini-3.1-pro-preview', // Use Pro model for detailed document generation
        contents: prompt,
      });

      const srsContent = response.text?.trim();
      if (!srsContent) throw new Error("No SRS generated");

      // Download the SRS as a Markdown file
      const blob = new Blob([srsContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const projectName = currentProject ? currentProject.name.toLowerCase().replace(/\s+/g, '-') : 'architecture';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}-srs-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to generate SRS:", error);
      alert("Failed to generate SRS report. Please try again.");
    } finally {
      setIsGeneratingSRS(false);
    }
  };

  const handleGenerateClarityReport = async () => {
    setIsGeneratingClarity(true);
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      const apiKey = hasKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
      const currentProject = projects.find(p => p.id === currentProjectId);

      const prompt = `Generate an "ADR Clarity & Health Report" for the following Architecture Decision Records (ADRs).

      Project: ${currentProject?.name || 'Untitled'}
      
      ADRs:
      ${JSON.stringify(graph.decisions, null, 2)}

      Please provide a structured Markdown report that includes:
      1. **Executive Summary**: Overall health of the decision log (how many proposed, accepted, deprecated).
      2. **Decision Lineage & Evolution**: A clear chronological narrative of how the architecture has evolved, specifically noting which decisions superseded or amended others.
      3. **Clarity & Completeness Assessment**: Identify any ADRs that are vague, lack clear rationale, have low confidence, or are missing consequences (pros/cons).
      4. **Risk & Conflict Analysis**: Highlight any contradictory decisions, orphaned decisions (not related to any knowledge nodes), or potential confusion points.
      5. **Actionable Recommendations**: What should the team do to improve the clarity of their architectural decisions?

      Keep it analytical, objective, and highly structured. Use Markdown formatting.`;

      const response = await callGeminiWithRetry(ai, {
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      const reportContent = response.text?.trim();
      if (!reportContent) throw new Error("No report generated");

      const blob = new Blob([reportContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const projectName = currentProject ? currentProject.name.toLowerCase().replace(/\s+/g, '-') : 'architecture';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}-adr-clarity-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Failed to generate Clarity Report:", error);
      alert("Failed to generate Clarity Report. Please try again.");
    } finally {
      setIsGeneratingClarity(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (messages.length === 0) return;
    setIsGeneratingSuggestions(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Based on the following architectural context, suggest 3-5 strategic architectural improvements or patterns that should be considered.
        
        Context:
        ${JSON.stringify({ nodes: graph.nodes, decisions: graph.decisions })}
        
        Return a JSON array of objects with: id, title, description, impact (high/medium/low).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                impact: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
              },
              required: ['id', 'title', 'description', 'impact']
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleEstimateCosts = async (provider: 'aws' | 'gcp' | 'azure') => {
    const infraNodes = graph.nodes.filter(n => n && n.layer === 'infrastructure');
    if (infraNodes.length === 0) {
      alert("No infrastructure components found to estimate costs for.");
      return;
    }

    setIsEstimatingCosts(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Based on the following infrastructure components, provide a monthly cost estimate for ${provider.toUpperCase()}.
        
        Components:
        ${JSON.stringify(infraNodes.map(n => n.text))}
        
        Return a JSON object with: provider, monthlyTotal (number), and breakdown (array of {service, cost, rationale}).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              provider: { type: Type.STRING },
              monthlyTotal: { type: Type.NUMBER },
              breakdown: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    service: { type: Type.STRING },
                    cost: { type: Type.NUMBER },
                    rationale: { type: Type.STRING }
                  },
                  required: ['service', 'cost', 'rationale']
                }
              }
            },
            required: ['provider', 'monthlyTotal', 'breakdown']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setCostEstimates(data);
    } catch (error) {
      console.error('Failed to estimate costs:', error);
    } finally {
      setIsEstimatingCosts(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.type === 'application/pdf') {
      // For PDF, we'll notify the user we're processing
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `📁 Processing PDF: ${file.name}...` }]);
      
      // PDF extraction is complex in browser without worker, 
      // for now we'll just read it as text if it's small or use a placeholder
      // In a real app, we'd use pdfjs-dist properly.
      // Let's try a simple text read for now or just handle .md
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        handleSend(`I've uploaded a file named ${file.name}. Here is its content for context:\n\n${text.substring(0, 5000)}`);
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.md') || file.type === 'text/markdown' || file.type === 'text/plain') {
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        handleSend(`I've uploaded a markdown/text file named ${file.name}. Here is its content for context:\n\n${text}`);
      };
      reader.readAsText(file);
    } else {
      alert("Unsupported file type. Please upload .pdf, .md, or .txt files.");
    }
  };

  const handleGenerateIaC = async (language: 'terraform' | 'cloudformation' | 'cdk') => {
    const infraNodes = graph.nodes.filter(n => n && n.layer === 'infrastructure');
    if (infraNodes.length === 0) {
      alert("No infrastructure components found to generate IaC for.");
      return;
    }

    setIsGeneratingIaC(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Generate an ${language.toUpperCase()} template for the following infrastructure components.
        
        Components:
        ${JSON.stringify(infraNodes.map(n => n.text))}
        
        Return a JSON object with: language, code (the actual IaC template), and explanation (brief summary of what was generated).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING },
              code: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['language', 'code', 'explanation']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setIacTemplate(data);
    } catch (error) {
      console.error('Failed to generate IaC:', error);
    } finally {
      setIsGeneratingIaC(false);
    }
  };

  const handleRunSecurityAudit = async () => {
    if (graph.nodes.length === 0) {
      alert("No system components found to audit.");
      return;
    }

    setIsAuditingSecurity(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Perform a security threat model and audit for the following system architecture.
        
        System Components:
        ${JSON.stringify(graph.nodes.map(n => ({ text: n.text, layer: n.layer, category: n.category })))}
        
        Return a JSON object with: 
        - score (number 0-100, where 100 is perfectly secure)
        - vulnerabilities (array of {title, severity: 'critical'|'high'|'medium'|'low', description, mitigation})`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              vulnerabilities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    description: { type: Type.STRING },
                    mitigation: { type: Type.STRING }
                  },
                  required: ['title', 'severity', 'description', 'mitigation']
                }
              }
            },
            required: ['score', 'vulnerabilities']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setSecurityAudit(data);
    } catch (error) {
      console.error('Failed to run security audit:', error);
    } finally {
      setIsAuditingSecurity(false);
    }
  };

  const handleGenerateSkeletons = async (language: string) => {
    const logicNodes = graph.nodes.filter(n => n && n.layer === 'logic');
    if (logicNodes.length === 0) {
      alert("No logic/service components found to generate skeletons for.");
      return;
    }

    setIsGeneratingSkeletons(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Generate service skeletons in ${language} for the following services:
        ${JSON.stringify(logicNodes.map(n => n.text))}
        
        Return a JSON array of objects, each containing:
        - serviceName
        - language
        - files (array of {path, content})`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                serviceName: { type: Type.STRING },
                language: { type: Type.STRING },
                files: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING },
                      content: { type: Type.STRING }
                    },
                    required: ['path', 'content']
                  }
                }
              },
              required: ['serviceName', 'language', 'files']
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setServiceSkeletons(data);
    } catch (error) {
      console.error('Failed to generate skeletons:', error);
    } finally {
      setIsGeneratingSkeletons(false);
    }
  };

  const handleRunComplianceCheck = async (standard: string) => {
    if (graph.nodes.length === 0) {
      alert("No system components found to check compliance for.");
      return;
    }

    setIsCheckingCompliance(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Evaluate the following architecture against the ${standard} compliance standard.
        
        Architecture:
        ${JSON.stringify(graph.nodes.map(n => ({ text: n.text, layer: n.layer, category: n.category })))}
        
        Return a JSON object with:
        - standard (string)
        - score (number 0-100)
        - findings (array of {requirement, status: 'compliant'|'non-compliant'|'partial', gap, recommendation})`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              standard: { type: Type.STRING },
              score: { type: Type.NUMBER },
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    requirement: { type: Type.STRING },
                    status: { type: Type.STRING },
                    gap: { type: Type.STRING },
                    recommendation: { type: Type.STRING }
                  },
                  required: ['requirement', 'status', 'gap', 'recommendation']
                }
              }
            },
            required: ['standard', 'score', 'findings']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setComplianceReport(data);
    } catch (error) {
      console.error('Failed to run compliance check:', error);
    } finally {
      setIsCheckingCompliance(false);
    }
  };

  const handleGenerateScorecard = async () => {
    if (graph.nodes.length === 0) {
      alert("No system components found to generate a scorecard.");
      return;
    }

    setIsGeneratingScorecard(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Generate a comprehensive Architecture Health Scorecard for the following system.
        
        Architecture:
        ${JSON.stringify(graph.nodes.map(n => ({ text: n.text, layer: n.layer, category: n.category })))}
        
        Consider Security, Cost, Compliance, and Performance.
        Return a JSON object with:
        - overall (number 0-100)
        - security (number 0-100)
        - cost (number 0-100)
        - compliance (number 0-100)
        - performance (number 0-100)
        - summary (string, brief executive summary)`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overall: { type: Type.NUMBER },
              security: { type: Type.NUMBER },
              cost: { type: Type.NUMBER },
              compliance: { type: Type.NUMBER },
              performance: { type: Type.NUMBER },
              summary: { type: Type.STRING }
            },
            required: ['overall', 'security', 'cost', 'compliance', 'performance', 'summary']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setHealthScorecard(data);
    } catch (error) {
      console.error('Failed to generate scorecard:', error);
    } finally {
      setIsGeneratingScorecard(false);
    }
  };

  const handleEstimatePerformance = async () => {
    if (graph.nodes.length === 0) {
      alert("No system components found to estimate performance.");
      return;
    }

    setIsEstimatingPerformance(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Estimate the performance and scalability of the following architecture.
        
        Architecture:
        ${JSON.stringify(graph.nodes.map(n => ({ text: n.text, layer: n.layer, category: n.category })))}
        
        Return a JSON object with:
        - tps (number, estimated transactions per second)
        - latency (string, e.g., "50ms - 200ms")
        - bottlenecks (array of strings)
        - scalability (string, brief analysis of how it scales)`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tps: { type: Type.NUMBER },
              latency: { type: Type.STRING },
              bottlenecks: { type: Type.ARRAY, items: { type: Type.STRING } },
              scalability: { type: Type.STRING }
            },
            required: ['tps', 'latency', 'bottlenecks', 'scalability']
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setPerformanceEstimate(data);
    } catch (error) {
      console.error('Failed to estimate performance:', error);
    } finally {
      setIsEstimatingPerformance(false);
    }
  };

  const handleApplyPattern = (pattern: typeof DESIGN_PATTERNS[0]) => {
    handleSend(`I want to apply the ${pattern.title} design pattern to my architecture. ${pattern.description} Please update the system design accordingly.`);
    setActiveTab('chat');
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;

    const newProject: Project = {
      id: Math.random().toString(36).substring(7),
      name: newProjectName,
      strategy: newProjectStrategy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: '1',
          role: 'model',
          text: `Hello! I'm your R&D Architecture Assistant. We are starting a new project: ${newProjectName} with a ${newProjectStrategy} strategy. What kind of system or feature are we designing today?`
        }
      ],
      graph: { nodes: [], decisions: [], conflicts: [] },
      tradeOffs: [],
      executiveSummary: undefined,
      syncIndex: 0
    };

    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newProject.id);
    setActiveTab('chat');
    setIsNewProjectModalOpen(false);
    setNewProjectName('');
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

  const handleRenameProject = (id: string, newName: string) => {
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
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-project-${new Date().toISOString().split('T')[0]}.json`;
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

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!overrideInput) setInput('');
    setIsTyping(true);
    setExtractionError(null);

    try {
      if (modelComparisonMode) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const comparisonModels = MODELS.map(m => m.id);
        
        const responses = await Promise.all(comparisonModels.map(async (modelId) => {
          try {
            const resp = await ai.models.generateContent({
              model: modelId,
              contents: userMsg.text
            });
            return { model: MODELS.find(m => m.id === modelId)?.name || modelId, text: resp.text || '' };
          } catch (e) {
            return { model: modelId, text: 'Error: Failed to get response from this model.' };
          }
        }));

        const botMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          role: 'model', 
          text: 'Model Comparison Results:',
          comparison: responses
        };
        const updatedMessages = [...newMessages, botMsg];
        setMessages(updatedMessages);
        if (autoSync) synthesizeKnowledge(updatedMessages);
      } else {
        const response = await chatRef.current.sendMessage({ message: userMsg.text });
        const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text };
        const updatedMessages = [...newMessages, botMsg];
        setMessages(updatedMessages);
        if (autoSync) synthesizeKnowledge(updatedMessages);
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
      const hasKey = await window.aistudio.hasSelectedApiKey();
      const apiKey = hasKey ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
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

      const response = await callGeminiWithRetry(ai, {
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
${(decision.status || 'proposed').toUpperCase()}

## Date
${decision.date || new Date().toLocaleDateString()}

## Deciders
${decision.deciders || 'Architect'}

${decision.supersedes ? `## Supersedes\nADR-${decision.supersedes.substring(0, 4)}\n\n` : ''}${decision.amends ? `## Amends\nADR-${decision.amends.substring(0, 4)}\n\n` : ''}## Context and Problem Statement
${decision.summary}

## Decision Outcome
${decision.rationale}

### Pros
${(decision.pros || []).map(p => `- ${p}`).join('\n')}

### Cons
${(decision.cons || []).map(c => `- ${c}`).join('\n')}

## Strategy Alignment
Confidence Score: ${decision.confidence}%
Layer: ${(decision.layer || 'unknown').toUpperCase()}
`;

    const blob = new Blob([adr], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADR-${decision.id.substring(0, 4)}-${decision.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateADRLineageMermaid = () => {
    const decisions = (graph.decisions || []).filter(d => d);
    if (decisions.length === 0) return 'graph TD\n  Empty[No Decisions Yet]';

    let mermaid = 'graph TD\n';
    mermaid += '  classDef accepted fill:#00E59922,stroke:#00E599,stroke-width:2px,color:#fff;\n';
    mermaid += '  classDef proposed fill:#3B82F622,stroke:#3B82F6,stroke-width:2px,color:#fff;\n';
    mermaid += '  classDef deprecated fill:#EF444422,stroke:#EF4444,stroke-width:2px,color:#fff;\n';
    mermaid += '  classDef superseded fill:#9CA3AF22,stroke:#9CA3AF,stroke-width:1px,color:#9CA3AF,stroke-dasharray: 5 5;\n';

    decisions.forEach(d => {
      const shortId = d.id.substring(0, 4).toUpperCase();
      const title = d.title.replace(/[\[\]\(\)\{\}]/g, '');
      mermaid += `  ${d.id}["ADR-${shortId}<br/>${title}"]\n`;
      
      if (d.status) {
        mermaid += `  class ${d.id} ${d.status}\n`;
      }

      if (d.supersedes) {
        mermaid += `  ${d.id} -- supersedes --> ${d.supersedes}\n`;
      }
      if (d.amends) {
        mermaid += `  ${d.id} -- amends --> ${d.amends}\n`;
      }
    });

    return mermaid;
  };

  const generateMermaid = () => {
    let mermaid = 'graph TD\n';
    
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
    return mermaid;
  };

  const generateSequenceDiagram = () => {
    const nodes = (graph.nodes || []).filter(n => n);
    if (nodes.length < 2) return 'sequenceDiagram\n  Note over User, AI: Not enough components for sequence';

    let mermaid = 'sequenceDiagram\n';
    mermaid += '  autonumber\n';
    
    // Pick some nodes to be participants
    const participants = nodes.slice(0, 5);
    participants.forEach(p => {
      mermaid += `  participant ${p.id.replace(/-/g, '_')} as ${p.text.substring(0, 20)}\n`;
    });

    // Create some mock interactions based on layers
    for (let i = 0; i < participants.length - 1; i++) {
      const from = participants[i];
      const to = participants[i+1];
      mermaid += `  ${from.id.replace(/-/g, '_')} ->> ${to.id.replace(/-/g, '_')}: Interaction\n`;
    }

    return mermaid;
  };

  const handleExport = () => {
    const timestamp = new Date().toLocaleString();
    const currentProject = projects.find(p => p.id === currentProjectId);
    const strategy = currentProject?.strategy || 'mvp';
    
    // Generate Mermaid Diagram
    const mermaidCode = generateMermaid();
    const mermaid = '```mermaid\n' + mermaidCode + '\n```';

    const md = `# Architecture Synthesis Report: ${currentProject?.name || 'Untitled Project'}
Generated on: ${timestamp}
**Strategy Alignment:** ${strategy.toUpperCase()}

${executiveSummary ? `## Executive Summary\n${executiveSummary}\n` : ''}

## Table of Contents
${executiveSummary ? '1. [Executive Summary](#executive-summary)\n' : ''}${executiveSummary ? '2' : '1'}. [Architecture Diagram](#architecture-diagram)
${executiveSummary ? '3' : '2'}. [Architecture Decision Records (ADR)](#architecture-decision-records-adr)
${executiveSummary ? '4' : '3'}. [Trade-off Analysis](#trade-off-analysis)
${executiveSummary ? '5' : '4'}. [Architectural Conflicts](#architectural-conflicts)
${executiveSummary ? '6' : '5'}. [Knowledge Map](#knowledge-map)

## Architecture Diagram
${mermaid}

## Architecture Decision Records (ADR)
${(graph.decisions || []).filter(d => d).map(d => `### ADR-${d.id.substring(0, 4)}: ${d.title || 'Untitled'}
- **Status:** ${(d.status || 'proposed').toUpperCase()}
- **Date:** ${d.date || 'N/A'}
- **Deciders:** ${d.deciders || 'N/A'}
${d.supersedes ? `- **Supersedes:** ADR-${d.supersedes.substring(0, 4)}\n` : ''}${d.amends ? `- **Amends:** ADR-${d.amends.substring(0, 4)}\n` : ''}- **Layer:** ${(d.layer || 'unknown').toUpperCase()}
- **Confidence:** ${d.confidence}%

#### Context
${d.summary || 'N/A'}

#### Decision Outcome
${d.rationale || 'N/A'}

#### Consequences
**Pros:**
${(d.pros || []).map(p => `- ${p}`).join('\n')}

**Cons:**
${(d.cons || []).map(c => `- ${c}`).join('\n')}`).join('\n\n---\n\n')}

## Trade-off Analysis
${(tradeOffs || []).map(t => `### ${t.topic}
**Recommendation:** ${t.recommendation}
**Strategy Alignment:** ${t.strategyAlignment}

| Feature | ${t.optionA.name} | ${t.optionB.name} |
|---------|-------------------|-------------------|
| **Cost** | ${t.optionA.cost.toUpperCase()} | ${t.optionB.cost.toUpperCase()} |
| **Complexity** | ${t.optionA.complexity.toUpperCase()} | ${t.optionB.complexity.toUpperCase()} |
| **Pros** | ${t.optionA.pros.join('<br/>')} | ${t.optionB.pros.join('<br/>')} |
| **Cons** | ${t.optionA.cons.join('<br/>')} | ${t.optionB.cons.join('<br/>')} |`).join('\n\n')}

## Architectural Conflicts
${(graph.conflicts || []).length > 0 
  ? (graph.conflicts || []).filter(c => c).map(c => `- **[${(c.severity || 'low').toUpperCase()}]** ${c.description}`).join('\n')
  : "_No conflicts detected._"}

## Knowledge Map
${(graph.nodes || []).filter(n => n).map(n => `- **[${(n.category || 'unknown').toUpperCase()}]** [${(n.layer || 'unknown').toUpperCase()}] ${n.text} (_Status: ${n.status}_)`).join('\n')}
`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
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

  const handleResetProject = () => {
    if (confirm('Are you sure you want to clear the current project? This will reset all messages and the knowledge map.')) {
      setMessages([
        {
          id: '1',
          role: 'model',
          text: "Hello! I'm your R&D Architecture Assistant. What kind of system or feature are we designing today?"
        }
      ]);
      setGraph({ nodes: [], decisions: [], conflicts: [] });
      setExecutiveSummary(undefined);
      lastSyncIndexRef.current = 0;
      
      // Re-initialize chat session
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      chatRef.current = ai.chats.create({
        model: selectedModel,
        config: {
          systemInstruction: "You are an expert System Architect and R&D assistant. Your goal is to help the user synthesize complex system designs. Categorize insights into layers: Infrastructure, Data, Logic, Interface, and Cross-cutting. Distinguish between immediate implementation constraints and long-term ambitions. Ask clarifying questions to verify assumptions. Be technical, concise, and analytical. You are encouraged to use Mermaid diagrams for flows and architectures using ```mermaid syntax."
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

  const handleResolveConflict = (conflict: Conflict) => {
    if (confirm('Would you like to create an Architecture Decision Record (ADR) to document how this conflict was resolved?')) {
      const newADR: Decision = {
        id: Math.random().toString(36).substring(2, 9),
        title: `Resolve: ${conflict.description.substring(0, 30)}...`,
        status: 'proposed',
        date: new Date().toISOString().split('T')[0],
        deciders: 'Architect',
        summary: `Resolving conflict: ${conflict.description}`,
        rationale: 'Describe how this conflict was resolved...',
        pros: [],
        cons: [],
        layer: 'cross-cutting',
        confidence: 80,
        relatedNodeIds: conflict.nodeIds || []
      };
      setGraph(prev => ({
        ...prev,
        decisions: [newADR, ...(prev.decisions || [])],
        conflicts: (prev.conflicts || []).filter(c => c.id !== conflict.id)
      }));
      setEditingDecision(newADR);
      setActiveTab('decisions');
    } else {
      setGraph(prev => ({
        ...prev,
        conflicts: (prev.conflicts || []).filter(c => c.id !== conflict.id)
      }));
    }
  };

  const askAiToResolve = (conflict: Conflict) => {
    const prompt = `I'd like to resolve this architectural conflict: "${conflict.description}". What are our options to reconcile this?`;
    setActiveTab('chat');
    handleSend(prompt);
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

  const handleNewADR = () => {
    const newADR: Decision = {
      id: Math.random().toString(36).substring(2, 9),
      title: 'New Architectural Decision',
      status: 'proposed',
      date: new Date().toISOString().split('T')[0],
      deciders: 'Architect',
      summary: 'Description of the context and problem...',
      rationale: 'Why this decision was made...',
      pros: [],
      cons: [],
      layer: 'infrastructure',
      confidence: 100,
      relatedNodeIds: []
    };
    setGraph(prev => ({
      ...prev,
      decisions: [newADR, ...(prev.decisions || [])]
    }));
    setEditingDecision(newADR);
  };

  const handleCreateNewVersion = (oldDecision: Decision) => {
    const newADR: Decision = {
      ...oldDecision,
      id: Math.random().toString(36).substring(2, 9),
      title: `${oldDecision.title} (v2)`,
      status: 'proposed',
      date: new Date().toISOString().split('T')[0],
      supersedes: oldDecision.id,
      amends: undefined
    };
    
    // Automatically mark the old one as superseded
    setGraph(prev => ({
      ...prev,
      decisions: [newADR, ...(prev.decisions || []).map(d => 
        d.id === oldDecision.id ? { ...d, status: 'superseded' as ADRStatus } : d
      )]
    }));
    
    setEditingDecision(newADR);
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

        <button 
          onClick={() => setActiveTab('diagram')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'diagram' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Mermaid Diagram"
        >
          <Layout className="w-5 h-5" />
          {activeTab === 'diagram' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('cost')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'cost' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Cloud Cost Estimator"
        >
          <DollarSign className="w-5 h-5" />
          {activeTab === 'cost' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('patterns')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'patterns' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Design Pattern Library"
        >
          <BookOpen className="w-5 h-5" />
          {activeTab === 'patterns' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('iac')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'iac' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Infrastructure as Code"
        >
          <Code className="w-5 h-5" />
          {activeTab === 'iac' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('security')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'security' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Security Audit"
        >
          <ShieldCheck className="w-5 h-5" />
          {activeTab === 'security' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('skeletons')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'skeletons' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Service Skeletons"
        >
          <Cpu className="w-5 h-5" />
          {activeTab === 'skeletons' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('compliance')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'compliance' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Compliance Mapping"
        >
          <FileCheck className="w-5 h-5" />
          {activeTab === 'compliance' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('scorecard')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'scorecard' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Architecture Scorecard"
        >
          <BarChart3 className="w-5 h-5" />
          {activeTab === 'scorecard' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <button 
          onClick={() => setActiveTab('performance')}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeTab === 'performance' ? "bg-[#141414] text-[#00E599] shadow-lg shadow-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-[#111]"
          )}
          title="Performance Estimator"
        >
          <Gauge className="w-5 h-5" />
          {activeTab === 'performance' && <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-6 bg-[#00E599] rounded-r-full" />}
        </button>

        <div className="mt-auto flex flex-col gap-4">
          <button 
            onClick={handleImportProject}
            className="p-3 rounded-xl text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Import Project (JSON)"
          >
            <Upload className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleExportProject(currentProjectId, {} as any)}
            className="p-3 rounded-xl text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title="Export Current Project (JSON)"
          >
            <FileJson className="w-5 h-5" />
          </button>
          <button 
            onClick={handleResetProject}
            className="p-3 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Reset Project (Clear Data)"
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
            onClick={() => setIsNewProjectModalOpen(true)}
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
                    onClick={(e) => { e.stopPropagation(); setShowProjectSettings(project.id); }}
                    className="p-1 hover:text-[#00E599]"
                    title="Settings"
                  >
                    <Settings className="w-3 h-3" />
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
        <button onClick={() => setActiveTab('diagram')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'diagram' ? "bg-[#262626] text-white" : "text-gray-500")}>Diagram</button>
        <button onClick={() => setActiveTab('cost')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'cost' ? "bg-[#262626] text-white" : "text-gray-500")}>Cost</button>
        <button onClick={() => setActiveTab('patterns')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'patterns' ? "bg-[#262626] text-white" : "text-gray-500")}>Patterns</button>
        <button onClick={() => setActiveTab('iac')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'iac' ? "bg-[#262626] text-white" : "text-gray-500")}>IaC</button>
        <button onClick={() => setActiveTab('security')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'security' ? "bg-[#262626] text-white" : "text-gray-500")}>Security</button>
        <button onClick={() => setActiveTab('skeletons')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'skeletons' ? "bg-[#262626] text-white" : "text-gray-500")}>Skeletons</button>
        <button onClick={() => setActiveTab('compliance')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'compliance' ? "bg-[#262626] text-white" : "text-gray-500")}>Compliance</button>
        <button onClick={() => setActiveTab('scorecard')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'scorecard' ? "bg-[#262626] text-white" : "text-gray-500")}>Scorecard</button>
        <button onClick={() => setActiveTab('performance')} className={cn("flex-1 py-2 text-xs font-medium rounded-md transition-colors text-center", activeTab === 'performance' ? "bg-[#262626] text-white" : "text-gray-500")}>Perf</button>
      </div>

      {/* LEFT PANE: Chat Sandbox */}
      {activeTab === 'chat' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col border-r border-[#262626] bg-[#0A0A0A] relative z-10 shadow-2xl min-h-0 flex-1"
        >
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
              <div className="flex items-center gap-2 lg:hidden">
                <select 
                  value={currentProjectId || ''} 
                  onChange={(e) => setCurrentProjectId(e.target.value)}
                  className="bg-transparent text-[10px] text-[#00E599] font-mono focus:outline-none cursor-pointer hover:underline max-w-[100px] truncate"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0A0A0A] text-white">{p.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setIsNewProjectModalOpen(true)}
                  className="p-0.5 rounded bg-[#141414] border border-[#262626] text-[#00E599]"
                  title="New Project"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <p className="hidden lg:block text-[10px] text-[#00E599] font-mono truncate max-w-[120px]">
                {projects.find(p => p.id === currentProjectId)?.name}
              </p>
            </div>
          </div>
          
          <div className="ml-auto flex items-center gap-3">
            <div className="relative flex items-center gap-2">
              {modelStatus[selectedModel] === 'quota_exceeded' && (
                <button
                  onClick={async () => {
                    await window.aistudio.openSelectKey();
                    // After selection, we assume success and clear the status
                    setModelStatus(prev => ({ ...prev, [selectedModel]: 'ok' }));
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-500 hover:bg-amber-500/20 transition-all uppercase tracking-widest"
                  title="Switch to a paid API key to avoid quota limits"
                >
                  <Shield className="w-3 h-3" />
                  Use Paid Key
                </button>
              )}
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
              onClick={() => setModelComparisonMode(!modelComparisonMode)}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded border transition-all text-[10px] font-bold uppercase tracking-widest",
                modelComparisonMode ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "border-[#262626] text-gray-500 hover:text-gray-300"
              )}
              title="Compare responses from multiple models side-by-side"
            >
              <Split className="w-3 h-3" />
              <span className="hidden sm:inline">Compare</span>
            </button>

            <button
              onClick={handleResetProject}
              className="text-[10px] font-mono text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
            >
              RESET PROJECT
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
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
                  "flex gap-3 sm:gap-4 max-w-[98%] sm:max-w-[90%] p-1 sm:p-2 rounded-xl transition-colors",
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
                  "px-3 sm:px-5 py-3 sm:py-4 rounded-2xl text-[13px] leading-relaxed shadow-sm relative group",
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
                    <div className="space-y-4">
                      {msg.comparison ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {msg.comparison.map((comp, i) => (
                            <div key={i} className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] space-y-3">
                              <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
                                <span className="text-[10px] font-bold text-[#00E599] uppercase tracking-widest">{comp.model}</span>
                                <button 
                                  onClick={() => copyToClipboard(comp.text, `${msg.id}-${i}`)}
                                  className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-[#00E599]"
                                >
                                  {copiedId === `${msg.id}-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                              <div className="markdown-body text-xs">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{comp.text}</ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-mermaid/.exec(className || '');
                                if (!inline && match) {
                                  return <Mermaid chart={String(children).replace(/\n$/, '')} enableZoom={false} />;
                                }
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      )}
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
        <div className="p-2 sm:p-4 border-t border-[#262626] bg-[#0A0A0A] shrink-0">
          <div className="relative flex items-end bg-[#141414] border border-[#262626] rounded-xl focus-within:border-[#00E599]/50 focus-within:ring-1 focus-within:ring-[#00E599]/50 transition-all">
            <div className="absolute left-2 bottom-2 flex items-center">
              <label className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 cursor-pointer transition-colors">
                <Paperclip className="w-4 h-4" />
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.md,.txt" />
              </label>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your system idea, constraints, or ask a question..."
              className="w-full max-h-48 min-h-[56px] bg-transparent text-sm text-gray-200 placeholder-gray-600 p-3 sm:p-4 pl-12 pr-12 resize-none focus:outline-none"
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-[#00E599] text-black hover:bg-[#00c282] disabled:opacity-50 disabled:hover:bg-[#00E599] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-gray-600 font-mono hidden sm:block">Shift + Enter for new line</p>
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
      </motion.div>
      )}

      {/* CENTER PANE: Knowledge Map */}
      {activeTab === 'map' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col border-r border-[#262626] bg-[#0A0A0A] min-h-0 flex-1"
        >
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
          <div className="flex gap-1 overflow-x-auto no-scrollbar items-center">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center transition-colors mr-1 shrink-0",
                viewMode === 'graph' ? "bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/30" : "bg-gray-800 text-gray-500"
              )}
              title="TOGGLE GRAPH VIEW"
            >
              <Share2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setVisionMode(!visionMode)}
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center transition-colors mr-2 shrink-0",
                visionMode ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-gray-800 text-gray-500"
              )}
              title="VISION MODE (AMBITIONS)"
            >
              <Sparkles className="w-3 h-3" />
            </button>
            <button
              onClick={handleAnalyzeGaps}
              disabled={isAnalyzingGaps}
              className="flex items-center gap-2 px-2 py-1 rounded border border-[#262626] text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all mr-2 disabled:opacity-50 shrink-0"
              title="Analyze Architecture Gaps"
            >
              <AlertTriangle className={cn("w-3 h-3", isAnalyzingGaps && "animate-pulse")} />
              <span className="hidden sm:inline">{isAnalyzingGaps ? 'Analyzing...' : 'Find Gaps'}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-2 py-1 rounded border border-[#262626] text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white hover:border-gray-700 transition-all mr-2 shrink-0"
              title="Export Full Synthesis Report (Markdown)"
            >
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Report</span>
            </button>
            <button
              onClick={handleGenerateSRS}
              disabled={isGeneratingSRS}
              className="flex items-center gap-2 px-2 py-1 rounded border border-[#262626] text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all mr-2 disabled:opacity-50 shrink-0"
              title="Generate Software Requirements Specification (SRS)"
            >
              <FileJson className={cn("w-3 h-3", isGeneratingSRS && "animate-pulse")} />
              <span className="hidden sm:inline">{isGeneratingSRS ? 'Generating...' : 'SRS'}</span>
            </button>
            <button
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingSuggestions}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded border transition-all mr-2 disabled:opacity-50 shrink-0 text-[10px] font-bold uppercase tracking-widest",
                suggestions.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "border-[#262626] text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30"
              )}
              title="Get AI Architectural Suggestions"
            >
              <Sparkles className={cn("w-3 h-3", isGeneratingSuggestions && "animate-pulse")} />
              <span className="hidden sm:inline">{isGeneratingSuggestions ? 'Thinking...' : 'Suggestions'}</span>
            </button>
            {['all', ...LAYERS.map(l => l.id)].map((l) => (
              <button
                key={l}
                onClick={() => setActiveLayer(l as any)}
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0",
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
                <div className="space-y-2">
                  {(graph.conflicts || []).map(conflict => (
                    <div key={conflict.id} className="group flex items-start justify-between gap-3 p-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 transition-all border border-red-500/10 hover:border-red-500/20 shadow-sm">
                      <div className="space-y-1 flex-1">
                        <div className="text-[11px] text-gray-300 flex gap-2 leading-relaxed">
                          <span className={cn(
                            "shrink-0 w-1.5 h-1.5 rounded-full mt-1.5",
                            conflict.severity === 'high' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          )} />
                          {conflict.description}
                        </div>
                        <div className="flex items-center gap-2 pl-3.5">
                          {conflict.nodeIds.map(nid => {
                            const node = graph.nodes.find(n => n.id === nid);
                            if (!node) return null;
                            return (
                              <span key={nid} className="text-[9px] font-mono text-gray-600 bg-black/20 px-1 rounded">
                                {node.text.substring(0, 10)}...
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                          onClick={() => askAiToResolve(conflict)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors"
                          title="Ask Architect to help resolve"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleResolveConflict(conflict)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors"
                          title="Dismiss warning"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                conflicts={graph.conflicts}
                onNodeClick={scrollToMessage} 
              />
            </div>
          ) : (
            graph.nodes.length > 0 ? (
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
                        activeLayer === layer.id && (
                          <div className="p-8 border border-dashed border-[#1A1A1A] rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                            <layer.icon className="w-6 h-6 text-gray-700" />
                            <p className="text-xs text-gray-600">No {layer.label.toLowerCase()} insights extracted yet.</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center">
                  <Layers className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">Knowledge Map Empty</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Start chatting with ArchBot to extract architectural insights, constraints, and system design elements.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('chat')}
                  className="px-4 py-2 rounded-lg bg-[#141414] border border-[#262626] text-xs font-medium text-[#00E599] hover:bg-[#1A1A1A] transition-colors"
                >
                  Go to Chat
                </button>
              </div>
            )
          )}
        </div>

        {/* AI Suggestions Side Panel */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="absolute top-16 bottom-0 right-0 w-80 border-l border-[#262626] bg-[#0A0A0A] flex flex-col shrink-0 z-30 shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-[#262626]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">AI Suggestions</h3>
                </div>
                <button onClick={() => setSuggestions([])} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {suggestions.map((suggestion, idx) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-2xl bg-[#141414] border border-[#262626] hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                        suggestion.impact === 'high' ? "bg-red-500/10 text-red-400" :
                        suggestion.impact === 'medium' ? "bg-amber-500/10 text-amber-400" :
                        "bg-blue-500/10 text-blue-400"
                      )}>
                        {suggestion.impact} Impact
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{suggestion.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">{suggestion.description}</p>
                    <button 
                      onClick={() => handleSend(`Tell me more about implementing ${suggestion.title}`)}
                      className="w-full py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                    >
                      Explore Pattern
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      )}

      {/* DIAGRAM VIEW */}
      {activeTab === 'diagram' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col border-r border-[#262626] bg-[#0A0A0A] min-h-0 flex-1"
        >
        <div className="h-16 flex items-center justify-between px-4 sm:px-6 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Layout className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white uppercase tracking-widest">Architecture Diagram</h2>
            <div className="h-4 w-px bg-[#262626] mx-2" />
            <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-xl border border-[#262626]">
              <button 
                onClick={() => setDiagramType('layers')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  diagramType === 'layers' ? "bg-[#00E599] text-black" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Layers
              </button>
              <button 
                onClick={() => setDiagramType('lineage')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  diagramType === 'lineage' ? "bg-[#00E599] text-black" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Lineage
              </button>
              <button 
                onClick={() => setDiagramType('sequence')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  diagramType === 'sequence' ? "bg-[#00E599] text-black" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Sequence
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
             <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#262626] text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-gray-700 transition-all"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4 sm:p-8 flex items-center justify-center bg-[#050505]">
          <div className="w-full h-full bg-[#050505] rounded-2xl border border-[#1A1A1A] shadow-2xl overflow-hidden">
            {activeTab === 'diagram' && (
              <Mermaid 
                chart={
                  diagramType === 'layers' ? generateMermaid() : 
                  diagramType === 'lineage' ? generateADRLineageMermaid() : 
                  generateSequenceDiagram()
                } 
              />
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Decision Ledger (ADR) */}
      {activeTab === 'decisions' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-medium text-white">ADR Manager</h2>
            </div>
            <div className="flex items-center bg-[#141414] rounded-lg p-1 border border-[#262626]">
              <button
                onClick={() => setAdrViewMode('list')}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                  adrViewMode === 'list' ? "bg-[#00E599] text-black" : "text-gray-500 hover:text-gray-300"
                )}
              >
                List
              </button>
              <button
                onClick={() => setAdrViewMode('lineage')}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                  adrViewMode === 'lineage' ? "bg-[#00E599] text-black" : "text-gray-500 hover:text-gray-300"
                )}
              >
                Lineage
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              onClick={handleNewADR}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00E599] text-black text-xs font-bold hover:bg-[#00CC88] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New ADR</span>
            </button>
            <button
              onClick={() => synthesizeKnowledge(messages, 0, true)}
              disabled={isExtracting}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                isExtracting ? "bg-gray-800 border-gray-700 text-gray-500" : "border-[#262626] text-gray-300 hover:bg-[#141414] hover:text-white"
              )}
            >
              <Sparkles className={cn("w-3.5 h-3.5", isExtracting && "animate-pulse")} />
              <span className="hidden sm:inline">{isExtracting ? 'Synthesizing...' : 'Synthesize'}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#262626] text-xs font-medium text-gray-300 hover:bg-[#141414] hover:text-white transition-colors"
              title="Export Full Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </button>
            <button
              onClick={handleGenerateSRS}
              disabled={isGeneratingSRS}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-500/30 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
              title="Generate Software Requirements Specification"
            >
              <FileJson className={cn("w-3.5 h-3.5", isGeneratingSRS && "animate-pulse")} />
              <span className="hidden sm:inline">{isGeneratingSRS ? 'Generating...' : 'SRS'}</span>
            </button>
            <button
              onClick={handleGenerateClarityReport}
              disabled={isGeneratingClarity}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-purple-500/30 text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
              title="Generate ADR Clarity & Health Report"
            >
              <Activity className={cn("w-3.5 h-3.5", isGeneratingClarity && "animate-pulse")} />
              <span className="hidden sm:inline">{isGeneratingClarity ? 'Analyzing...' : 'Clarity Report'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Executive Summary Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 p-8 rounded-2xl bg-[#050505] border border-[#1A1A1A] relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Executive Summary</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-mono tracking-tight">The Architecture Story</p>
                  </div>
                </div>
                <button
                  onClick={generateExecutiveSummary}
                  disabled={isGeneratingSummary}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#262626] text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-gray-700 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3 h-3", isGeneratingSummary && "animate-spin")} />
                  {executiveSummary ? 'Regenerate' : 'Generate'}
                </button>
              </div>

              {isGeneratingSummary ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-900 rounded w-3/4" />
                  <div className="h-4 bg-gray-900 rounded w-1/2" />
                  <div className="h-4 bg-gray-900 rounded w-5/6" />
                </div>
              ) : executiveSummary ? (
                <div className="markdown-body prose prose-invert prose-sm max-w-none text-gray-400 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{executiveSummary}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-gray-600 italic">No summary generated yet. Click generate to synthesize your architecture story.</p>
                </div>
              )}
            </motion.div>

            {adrViewMode === 'lineage' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full aspect-video bg-[#050505] rounded-2xl border border-[#1A1A1A] p-4 shadow-2xl overflow-hidden"
              >
                <div className="w-full h-full">
                  {activeTab === 'decisions' && <Mermaid chart={generateADRLineageMermaid()} />}
                </div>
              </motion.div>
            ) : (
              (graph.decisions || []).length > 0 ? (
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
                                decision.status === 'superseded' ? "bg-gray-500/10 text-gray-500" :
                                "bg-red-500/10 text-red-400"
                              )}>
                                {decision.status || 'proposed'}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white">{decision.title}</h3>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleCreateNewVersion(decision)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-purple-400 transition-colors" title="Create New Version (Supersede)"><RefreshCw className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleExportADR(decision)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-emerald-400 transition-colors" title="Export ADR"><Download className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingDecision(decision)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-blue-400 transition-colors" title="Edit ADR"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteDecision(decision.id)} className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-600 hover:text-red-400 transition-colors" title="Delete ADR"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] font-mono">
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
                          {(decision.supersedes || decision.amends) && (
                            <div className="flex flex-wrap gap-2">
                              {decision.supersedes && (
                                <div className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-mono">
                                  SUPERSEDES: {graph.decisions.find(d => d?.id === decision.supersedes)?.title || 'Unknown'}
                                </div>
                              )}
                              {decision.amends && (
                                <div className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-mono">
                                  AMENDS: {graph.decisions.find(d => d?.id === decision.amends)?.title || 'Unknown'}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Context</p>
                            <p className="text-[13px] text-gray-400 leading-relaxed">{decision.summary}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Decision Outcome</p>
                            <p className="text-[13px] text-gray-300 leading-relaxed">{decision.rationale}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4 border border-dashed border-[#262626] rounded-3xl bg-[#111]/30">
                  <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#262626] flex items-center justify-center shadow-inner">
                    <ListChecks className="w-8 h-8 text-gray-700" />
                  </div>
                  <div className="max-w-xs space-y-2">
                    <h3 className="text-white font-medium text-lg">No Decisions Yet</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Architecture Decision Records (ADRs) help document the "why" behind your design. Create one manually or let ArchBot extract them from your chat.
                    </p>
                  </div>
                  <button 
                    onClick={handleNewADR}
                    className="px-4 py-2 rounded-lg bg-[#141414] border border-[#262626] text-xs font-medium text-[#00E599] hover:bg-[#1A1A1A] transition-colors"
                  >
                    Create First ADR
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Trade-off Matrix */}
      {activeTab === 'matrix' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
        <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Trade-off Matrix</h2>
          </div>
          <button
            onClick={() => {
              const topic = prompt('What architectural choice would you like to compare? (e.g., "SQL vs NoSQL", "Serverless vs K8s")');
              if (topic) handleGenerateTradeOff(topic);
            }}
            disabled={isExtracting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00E599] text-black text-xs font-bold hover:bg-[#00CC88] transition-colors disabled:opacity-50 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Comparison</span>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </motion.div>
      )}

      {/* RIGHT PANE: Cloud Cost Estimator */}
      {activeTab === 'cost' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Cloud Cost Estimator</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEstimateCosts('aws')}
              disabled={isEstimatingCosts}
              className="px-3 py-1.5 rounded-md bg-[#FF9900] text-black text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              AWS
            </button>
            <button
              onClick={() => handleEstimateCosts('gcp')}
              disabled={isEstimatingCosts}
              className="px-3 py-1.5 rounded-md bg-[#4285F4] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              GCP
            </button>
            <button
              onClick={() => handleEstimateCosts('azure')}
              disabled={isEstimatingCosts}
              className="px-3 py-1.5 rounded-md bg-[#0089D6] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Azure
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {isEstimatingCosts ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-[#00E599] animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse">CALCULATING INFRASTRUCTURE COSTS...</p>
              </div>
            ) : costEstimates ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="p-8 rounded-3xl bg-gradient-to-br from-[#111] to-[#050505] border border-[#1A1A1A] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">{costEstimates.provider} ESTIMATE</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Total Monthly Estimate</p>
                    <h3 className="text-5xl font-bold text-white tracking-tighter">
                      ${costEstimates.monthlyTotal.toLocaleString()}
                      <span className="text-lg text-gray-600 ml-2">/mo</span>
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Service Breakdown</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {costEstimates.breakdown.map((item, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] flex items-center justify-between group hover:border-[#00E599]/30 transition-all">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white">{item.service}</p>
                          <p className="text-xs text-gray-500">{item.rationale}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#00E599]">${item.cost}</p>
                          <p className="text-[9px] text-gray-600 uppercase font-mono">EST. MONTHLY</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <DollarSign className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">Cost Estimator</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Select a cloud provider to estimate the monthly infrastructure costs for your current system design.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Design Pattern Library */}
      {activeTab === 'patterns' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Design Pattern Library</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {DESIGN_PATTERNS.map((pattern, idx) => (
              <motion.div
                key={pattern.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#00E599]/30 transition-all group flex flex-col h-full"
              >
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-[#00E599] transition-colors">{pattern.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{pattern.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Pros</p>
                      <ul className="space-y-1">
                        {pattern.pros.map((p, i) => (
                          <li key={i} className="text-[11px] text-gray-400 flex items-start gap-2">
                            <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest">Cons</p>
                      <ul className="space-y-1">
                        {pattern.cons.map((c, i) => (
                          <li key={i} className="text-[11px] text-gray-400 flex items-start gap-2">
                            <X className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleApplyPattern(pattern)}
                  className="mt-8 w-full py-3 rounded-xl bg-[#141414] border border-[#262626] text-xs font-bold text-white uppercase tracking-widest hover:bg-[#00E599] hover:text-black hover:border-transparent transition-all"
                >
                  Apply Pattern
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Infrastructure as Code (IaC) */}
      {activeTab === 'iac' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Code className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Infrastructure as Code</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateIaC('terraform')}
              disabled={isGeneratingIaC}
              className="px-3 py-1.5 rounded-md bg-[#5C4EE5] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Terraform
            </button>
            <button
              onClick={() => handleGenerateIaC('cloudformation')}
              disabled={isGeneratingIaC}
              className="px-3 py-1.5 rounded-md bg-[#FF9900] text-black text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              CloudFormation
            </button>
            <button
              onClick={() => handleGenerateIaC('cdk')}
              disabled={isGeneratingIaC}
              className="px-3 py-1.5 rounded-md bg-[#232F3E] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              AWS CDK
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {isGeneratingIaC ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-[#00E599] animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse">GENERATING INFRASTRUCTURE TEMPLATE...</p>
              </div>
            ) : iacTemplate ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#00E599] uppercase tracking-widest">{iacTemplate.language} TEMPLATE</span>
                    <button 
                      onClick={() => copyToClipboard(iacTemplate.code, 'iac-code')}
                      className="flex items-center gap-2 px-3 py-1 rounded bg-[#1A1A1A] text-gray-400 hover:text-white transition-colors text-[10px] font-bold uppercase"
                    >
                      {copiedId === 'iac-code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy Code
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-black border border-[#1A1A1A] text-xs text-emerald-500 font-mono overflow-x-auto">
                    <code>{iacTemplate.code}</code>
                  </pre>
                </div>
                <div className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Explanation</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">{iacTemplate.explanation}</p>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <Code className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">IaC Generator</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Select a template format to generate Infrastructure as Code for your current system design.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Security Audit */}
      {activeTab === 'security' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Security Audit & Threat Model</h2>
          </div>
          <button
            onClick={handleRunSecurityAudit}
            disabled={isAuditingSecurity}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold uppercase hover:bg-red-500/20 transition-all disabled:opacity-50"
          >
            <Activity className={cn("w-3.5 h-3.5", isAuditingSecurity && "animate-pulse")} />
            {isAuditingSecurity ? 'Auditing...' : 'Run Security Audit'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {isAuditingSecurity ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse uppercase">ANALYZING ATTACK VECTORS & VULNERABILITIES...</p>
              </div>
            ) : securityAudit ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="p-8 rounded-3xl bg-gradient-to-br from-[#111] to-[#050505] border border-[#1A1A1A] flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Security Health Score</p>
                    <h3 className={cn(
                      "text-6xl font-bold tracking-tighter",
                      securityAudit.score >= 80 ? "text-emerald-500" : securityAudit.score >= 50 ? "text-amber-500" : "text-red-500"
                    )}>
                      {securityAudit.score}
                      <span className="text-lg text-gray-600 ml-2">/100</span>
                    </h3>
                  </div>
                  <div className="w-24 h-24 rounded-full border-4 border-[#1A1A1A] flex items-center justify-center relative">
                    <div 
                      className={cn(
                        "absolute inset-0 rounded-full border-4 transition-all duration-1000",
                        securityAudit.score >= 80 ? "border-emerald-500" : securityAudit.score >= 50 ? "border-amber-500" : "border-red-500"
                      )}
                      style={{ clipPath: `inset(${100 - securityAudit.score}% 0 0 0)` }}
                    />
                    <ShieldCheck className={cn(
                      "w-10 h-10",
                      securityAudit.score >= 80 ? "text-emerald-500" : securityAudit.score >= 50 ? "text-amber-500" : "text-red-500"
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Vulnerability Assessment</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {securityAudit.vulnerabilities.map((v, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4 group hover:border-red-500/30 transition-all">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-white">{v.title}</h5>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
                            v.severity === 'critical' ? "bg-red-500 text-white" :
                            v.severity === 'high' ? "bg-orange-500 text-white" :
                            v.severity === 'medium' ? "bg-amber-500 text-black" : "bg-blue-500 text-white"
                          )}>
                            {v.severity}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <p className="text-[9px] text-gray-600 uppercase font-bold">Description</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{v.description}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
                            <p className="text-[9px] text-emerald-500/70 uppercase font-bold">Mitigation Strategy</p>
                            <p className="text-xs text-gray-300 leading-relaxed">{v.mitigation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">Security Auditor</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Run a comprehensive security audit to identify potential vulnerabilities and threat vectors in your architecture.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Service Skeletons */}
      {activeTab === 'skeletons' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Cpu className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Service Skeleton Generator</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateSkeletons('Node.js/Express')}
              disabled={isGeneratingSkeletons}
              className="px-3 py-1.5 rounded-md bg-[#8CC84B] text-black text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Node.js
            </button>
            <button
              onClick={() => handleGenerateSkeletons('Python/FastAPI')}
              disabled={isGeneratingSkeletons}
              className="px-3 py-1.5 rounded-md bg-[#3776AB] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Python
            </button>
            <button
              onClick={() => handleGenerateSkeletons('Go/Gin')}
              disabled={isGeneratingSkeletons}
              className="px-3 py-1.5 rounded-md bg-[#00ADD8] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Go
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {isGeneratingSkeletons ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-[#00E599] animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse uppercase">SCAFFOLDING SERVICE ARCHITECTURE...</p>
              </div>
            ) : serviceSkeletons.length > 0 ? (
              <div className="space-y-12">
                {serviceSkeletons.map((service, sIdx) => (
                  <motion.div
                    key={sIdx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sIdx * 0.1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center">
                          <Cpu className="w-4 h-4 text-[#00E599]" />
                        </div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">{service.serviceName}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{service.language}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {service.files.map((file, fIdx) => (
                        <div key={fIdx} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-xs font-mono text-gray-400">{file.path}</span>
                            </div>
                            <button 
                              onClick={() => copyToClipboard(file.content, `skeleton-${sIdx}-${fIdx}`)}
                              className="p-1.5 rounded hover:bg-[#1A1A1A] text-gray-500 hover:text-white transition-colors"
                            >
                              {copiedId === `skeleton-${sIdx}-${fIdx}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <pre className="p-4 rounded-xl bg-black border border-[#1A1A1A] text-[11px] text-emerald-500 font-mono overflow-x-auto">
                            <code>{file.content}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <Cpu className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">Skeleton Generator</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Generate boilerplate code and folder structures for the services defined in your architecture.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Compliance Mapping */}
      {activeTab === 'compliance' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <FileCheck className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Compliance Mapping</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunComplianceCheck('SOC2')}
              disabled={isCheckingCompliance}
              className="px-3 py-1.5 rounded-md border border-[#262626] text-gray-300 text-[10px] font-bold uppercase hover:bg-[#141414] transition-colors disabled:opacity-50"
            >
              SOC2
            </button>
            <button
              onClick={() => handleRunComplianceCheck('GDPR')}
              disabled={isCheckingCompliance}
              className="px-3 py-1.5 rounded-md border border-[#262626] text-gray-300 text-[10px] font-bold uppercase hover:bg-[#141414] transition-colors disabled:opacity-50"
            >
              GDPR
            </button>
            <button
              onClick={() => handleRunComplianceCheck('HIPAA')}
              disabled={isCheckingCompliance}
              className="px-3 py-1.5 rounded-md border border-[#262626] text-gray-300 text-[10px] font-bold uppercase hover:bg-[#141414] transition-colors disabled:opacity-50"
            >
              HIPAA
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {isCheckingCompliance ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse uppercase">MAPPING ARCHITECTURE TO REGULATORY STANDARDS...</p>
              </div>
            ) : complianceReport ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="p-8 rounded-3xl bg-gradient-to-br from-[#111] to-[#050505] border border-[#1A1A1A] flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{complianceReport.standard} Readiness Score</p>
                    <h3 className={cn(
                      "text-6xl font-bold tracking-tighter",
                      complianceReport.score >= 80 ? "text-emerald-500" : complianceReport.score >= 50 ? "text-amber-500" : "text-red-500"
                    )}>
                      {complianceReport.score}
                      <span className="text-lg text-gray-600 ml-2">/100</span>
                    </h3>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
                    <FileCheck className={cn(
                      "w-12 h-12",
                      complianceReport.score >= 80 ? "text-emerald-500" : complianceReport.score >= 50 ? "text-amber-500" : "text-red-500"
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Compliance Findings</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {complianceReport.findings.map((finding, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-white">{finding.requirement}</h5>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
                            finding.status === 'compliant' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            finding.status === 'partial' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            "bg-red-500/20 text-red-400 border border-red-500/30"
                          )}>
                            {finding.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[9px] text-gray-600 uppercase font-bold">Gap Analysis</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{finding.gap}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] text-emerald-500/70 uppercase font-bold">Recommendation</p>
                            <p className="text-xs text-gray-300 leading-relaxed">{finding.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <FileCheck className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">Compliance Auditor</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Map your architecture against regulatory standards to identify gaps in data residency, encryption, and governance.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Architecture Health Scorecard */}
      {activeTab === 'scorecard' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Architecture Health Scorecard</h2>
          </div>
          <button
            onClick={handleGenerateScorecard}
            disabled={isGeneratingScorecard}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#00E599]/10 border border-[#00E599]/30 text-[#00E599] text-xs font-bold uppercase hover:bg-[#00E599]/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isGeneratingScorecard && "animate-spin")} />
            {isGeneratingScorecard ? 'Generating...' : 'Generate Scorecard'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {isGeneratingScorecard ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-[#00E599] animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse uppercase">AGGREGATING ARCHITECTURAL INTELLIGENCE...</p>
              </div>
            ) : healthScorecard ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="p-8 rounded-3xl bg-gradient-to-br from-[#111] to-[#050505] border border-[#1A1A1A] flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Overall Readiness Score</p>
                    <h3 className={cn(
                      "text-7xl font-bold tracking-tighter",
                      healthScorecard.overall >= 80 ? "text-emerald-500" : healthScorecard.overall >= 50 ? "text-amber-500" : "text-red-500"
                    )}>
                      {healthScorecard.overall}
                      <span className="text-lg text-gray-600 ml-2">/100</span>
                    </h3>
                  </div>
                  <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626]">
                    <Sparkles className={cn(
                      "w-12 h-12",
                      healthScorecard.overall >= 80 ? "text-emerald-500" : healthScorecard.overall >= 50 ? "text-amber-500" : "text-red-500"
                    )} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { label: 'Security', score: healthScorecard.security, icon: ShieldCheck, color: 'text-red-500' },
                    { label: 'Cost Efficiency', score: healthScorecard.cost, icon: DollarSign, color: 'text-emerald-500' },
                    { label: 'Compliance', score: healthScorecard.compliance, icon: FileCheck, color: 'text-blue-500' },
                    { label: 'Performance', score: healthScorecard.performance, icon: Gauge, color: 'text-amber-500' }
                  ].map((stat, idx) => (
                    <div key={idx} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <stat.icon className={cn("w-4 h-4", stat.color)} />
                          <span className="text-xs font-bold text-white uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <span className={cn("text-xl font-bold", stat.color)}>{stat.score}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stat.score}%` }}
                          className={cn("h-full", stat.color.replace('text-', 'bg-'))} 
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Executive Summary</h4>
                  <p className="text-sm text-gray-300 leading-relaxed italic">"{healthScorecard.summary}"</p>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">System Readiness Scorecard</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Generate a high-level health report that aggregates security, cost, compliance, and performance metrics.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* RIGHT PANE: Performance Estimator */}
      {activeTab === 'performance' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col bg-[#0A0A0A] min-h-0 flex-1"
        >
          <div className="h-16 flex items-center justify-between px-4 md:px-8 glass-header shrink-0 overflow-x-auto no-scrollbar gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Gauge className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-white">Performance & Scalability Estimator</h2>
          </div>
          <button
            onClick={handleEstimatePerformance}
            disabled={isEstimatingPerformance}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase hover:bg-amber-500/20 transition-all disabled:opacity-50"
          >
            <Zap className={cn("w-3.5 h-3.5", isEstimatingPerformance && "animate-pulse")} />
            {isEstimatingPerformance ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {isEstimatingPerformance ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                <p className="text-sm text-gray-500 font-mono animate-pulse uppercase">SIMULATING TRAFFIC & BOTTLENECKS...</p>
              </div>
            ) : performanceEstimate ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-2">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Estimated Throughput</p>
                    <h3 className="text-5xl font-bold text-white tracking-tighter">
                      {performanceEstimate.tps.toLocaleString()}
                      <span className="text-lg text-gray-600 ml-2">TPS</span>
                    </h3>
                  </div>
                  <div className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-2">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Estimated Latency</p>
                    <h3 className="text-5xl font-bold text-amber-500 tracking-tighter">
                      {performanceEstimate.latency}
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Identified Bottlenecks</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {performanceEstimate.bottlenecks.map((b, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-sm text-gray-300">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-[#0D0D0D] border border-[#1A1A1A] space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#00E599]" />
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scalability Analysis</h4>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{performanceEstimate.scalability}</p>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#111] border border-[#1A1A1A] flex items-center justify-center">
                  <Gauge className="w-8 h-8 text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-white font-medium">Performance Estimator</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">Simulate system performance to estimate throughput, latency, and identify potential architectural bottlenecks.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      )}
    </div>

    {/* Edit Node Modal */}
    <AnimatePresence>
      {/* PROJECT SETTINGS MODAL */}
      <AnimatePresence>
        {showProjectSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#1A1A1A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#141414] border border-[#262626]">
                    <Settings className="w-5 h-5 text-[#00E599]" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Project Settings</h2>
                </div>
                <button 
                  onClick={() => setShowProjectSettings(null)}
                  className="p-2 rounded-lg hover:bg-[#141414] text-gray-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Project Name</label>
                  <input
                    type="text"
                    value={projects.find(p => p.id === showProjectSettings)?.name || ''}
                    onChange={(e) => handleRenameProject(showProjectSettings, e.target.value)}
                    className="w-full bg-[#050505] border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00E599] transition-colors"
                    placeholder="Enter project name..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Architectural Strategy</label>
                  <select
                    value={projects.find(p => p.id === showProjectSettings)?.strategy || 'mvp'}
                    onChange={(e) => handleUpdateProjectStrategy(showProjectSettings, e.target.value as any)}
                    className="w-full bg-[#050505] border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00E599] transition-colors"
                  >
                    <option value="mvp">MVP (Speed & Core Value)</option>
                    <option value="scale">Scale (Performance & Resilience)</option>
                    <option value="hybrid">Hybrid (Balanced Growth)</option>
                  </select>
                  <p className="text-[10px] text-gray-500 italic">
                    This strategy guides ArchBot's synthesis and conflict detection.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-[#050505] border-t border-[#1A1A1A] flex justify-end">
                <button
                  onClick={() => setShowProjectSettings(null)}
                  className="px-6 py-2 rounded-xl bg-[#00E599] text-black font-bold text-sm hover:bg-[#00CC88] transition-all shadow-[0_0_20px_rgba(0,229,153,0.2)]"
                >
                  Close Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Category</label>
                  <select value={editingNode.category} onChange={e => setEditingNode({...editingNode, category: e.target.value as KnowledgeCategory})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50">
                    <option value="constraint">Constraint</option>
                    <option value="use-case">Use Case</option>
                    <option value="ambition">Ambition</option>
                    <option value="insight">Insight</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Layer</label>
                  <select value={editingNode.layer} onChange={e => setEditingNode({...editingNode, layer: e.target.value as KnowledgeLayer})} className="w-full bg-[#141414] border border-[#262626] rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50">
                    <option value="infrastructure">Infrastructure</option>
                    <option value="data">Data</option>
                    <option value="logic">Logic</option>
                    <option value="interface">Interface</option>
                    <option value="cross-cutting">Cross-cutting</option>
                  </select>
                </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Supersedes</label>
                  <select 
                    value={editingDecision.supersedes || ''} 
                    onChange={e => setEditingDecision({...editingDecision, supersedes: e.target.value || undefined})}
                    className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50"
                  >
                    <option value="">None</option>
                    {(graph.decisions || []).filter(d => d && d.id !== editingDecision.id).map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Amends</label>
                  <select 
                    value={editingDecision.amends || ''} 
                    onChange={e => setEditingDecision({...editingDecision, amends: e.target.value || undefined})}
                    className="w-full bg-[#141414] border border-[#262626] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#00E599]/50"
                  >
                    <option value="">None</option>
                    {(graph.decisions || []).filter(d => d && d.id !== editingDecision.id).map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                </div>
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
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest">Related Knowledge Nodes</label>
                <div className="max-h-32 overflow-y-auto bg-[#141414] border border-[#262626] rounded-lg p-2 space-y-1">
                  {(graph.nodes || []).map(node => (
                    <label key={node.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:bg-[#1A1A1A] p-1.5 rounded">
                      <input 
                        type="checkbox" 
                        checked={(editingDecision.relatedNodeIds || []).includes(node.id)}
                        onChange={(e) => {
                          const newIds = e.target.checked 
                            ? [...(editingDecision.relatedNodeIds || []), node.id]
                            : (editingDecision.relatedNodeIds || []).filter(id => id !== node.id);
                          setEditingDecision({...editingDecision, relatedNodeIds: newIds});
                        }}
                        className="accent-[#00E599]"
                      />
                      <span className="truncate">{node.text}</span>
                    </label>
                  ))}
                  {(graph.nodes || []).length === 0 && (
                    <p className="text-xs text-gray-500 p-1">No knowledge nodes available.</p>
                  )}
                </div>
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
    
    {/* NEW PROJECT MODAL */}
    <AnimatePresence>
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-[#0F0F0F] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-[#262626] flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Initialize New Project</h3>
              <button onClick={() => setIsNewProjectModalOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Project Name</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Distributed Ledger v2"
                  className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00E599] transition-colors"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Architecture Strategy</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['mvp', 'scale', 'hybrid'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewProjectStrategy(s)}
                      className={cn(
                        "px-3 py-4 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all text-center",
                        newProjectStrategy === s 
                          ? "bg-[#00E599]/10 border-[#00E599] text-[#00E599]" 
                          : "bg-[#141414] border-[#262626] text-gray-500 hover:border-gray-700"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-2">
                  {newProjectStrategy === 'mvp' && "Optimized for speed, simplicity, and rapid iteration."}
                  {newProjectStrategy === 'scale' && "Optimized for high availability, performance, and robustness."}
                  {newProjectStrategy === 'hybrid' && "Balanced approach for growing systems."}
                </p>
              </div>
            </div>
            <div className="p-6 bg-[#141414] flex gap-3">
              <button 
                onClick={() => setIsNewProjectModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-[#262626] text-gray-400 font-bold uppercase tracking-widest text-xs hover:bg-[#1A1A1A] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 py-3 rounded-xl bg-[#00E599] text-black font-bold uppercase tracking-widest text-xs hover:bg-[#00c282] disabled:opacity-50 transition-colors"
              >
                Create Project
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
  );
}
