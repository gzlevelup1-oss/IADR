import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mermaid } from './Mermaid';
import { cn } from '../App';

interface ChatMessageProps {
  msg: any;
  highlightedMessageId: string | null;
  copyToClipboard: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ChatMessage = React.memo(({ msg, highlightedMessageId, copyToClipboard, copiedId }: ChatMessageProps) => {
  return (
    <motion.div
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
                {msg.comparison.map((comp: any, i: number) => (
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
  );
});
