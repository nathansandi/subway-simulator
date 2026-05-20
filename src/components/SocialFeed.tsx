import React from 'react';
import { CitizenPost, GameEvent } from '../types';
import { Sparkles, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

interface SocialFeedProps {
  posts: CitizenPost[];
  events: GameEvent[];
  aiReport: string | null;
  loadingAi: boolean;
  onTriggerAi: () => void;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({
  posts,
  events,
  aiReport,
  loadingAi,
  onTriggerAi
}) => {
  return (
    <div className="flex flex-col h-[450px] bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white overflow-hidden shadow-xl" id="social-feed-container">
      {/* Active Events Indicator banner */}
      {events.length > 0 && (
        <div className="mb-4 space-y-2" id="active-events-list">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> City Incidents
          </h4>
          {events.map((ev) => (
            <div
              key={ev.id}
              className={`p-3 rounded-xl border flex flex-col gap-1 text-xs animate-pulse ${
                ev.severity === 'high'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
              id={`event-card-${ev.id}`}
            >
              <div className="flex justify-between font-bold">
                <span>⚡ {ev.title}</span>
                <span className="font-mono text-[10px] uppercase bg-black/40 px-1.5 py-0.5 rounded">
                  {ev.ticksRemaining}m left
                </span>
              </div>
              <p className="opacity-90 leading-relaxed">{ev.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Advisory Panel Section */}
      <div className="mb-4 bg-white/5 rounded-xl border border-white/10 p-3.5 flex flex-col gap-3" id="ai-advisor-panel">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 fill-indigo-400/20" /> Gemini Transit Advisor
          </h4>
          <button
            onClick={onTriggerAi}
            disabled={loadingAi}
            className="text-[11px] bg-indigo-600 hover:bg-indigo-550 active:translate-y-0.5 text-white py-1 px-2.5 rounded-lg flex items-center gap-1 transition-all disabled:opacity-50 font-bold"
            id="ask-gemini-button"
          >
            <RefreshCw className={`w-3 h-3 ${loadingAi ? 'animate-spin' : ''}`} />
            {loadingAi ? 'Analyzing...' : 'Ask AI Analyst'}
          </button>
        </div>

        <div className="text-xs leading-relaxed max-h-44 overflow-y-auto pr-1 space-y-2 text-slate-300 border-t border-white/5 pt-2 font-sans" id="ai-report-content">
          {aiReport ? (
            <div className="prose prose-invert prose-xs text-indigo-100/90 whitespace-pre-wrap">
              {aiReport}
            </div>
          ) : (
            <p className="italic text-slate-500">
              No advisory report generated yet. Click above to summon Gemini to analyze overcrowding, scheduling, and city events!
            </p>
          )}
        </div>
      </div>

      {/* Citizen social posts scroll */}
      <div className="flex-1 flex flex-col min-h-0" id="citizen-feed-sub-container">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
          <MessageSquare className="w-4 h-4" /> Live City Social Feed
        </h4>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5" id="citizen-posts-list">
          {posts.length === 0 ? (
            <div className="text-center text-slate-600 italic py-8 text-xs">Waiting for citizens to board lines...</div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className={`p-3 rounded-xl border transition-all text-xs flex gap-2.5 ${
                  post.sentiment === 'positive'
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                    : post.sentiment === 'negative'
                    ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                id={`citizen-post-${post.id}`}
              >
                <div className="text-xl shrink-0 selection:bg-transparent">{post.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-mono font-semibold text-slate-200 select-all truncate">
                      {post.handle}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">{post.timestamp}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{post.text}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
