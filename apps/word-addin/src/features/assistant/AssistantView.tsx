import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock3, FileSearch, History, LogOut, MessageSquareText, Plus, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { api } from '../../services/api-client';
import { supabase } from '../../services/supabase-client';
import { wordDocumentService, WordDocumentService } from '../../services/word-document.service';
import type { HistoryItem, LexheroAction, LexheroRequest, LexheroResponse } from '../../types';
import { ResponsePanel } from './ResponsePanel';
import { PromptComposer } from './PromptComposer';

type ConversationMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; response: LexheroResponse };

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ConversationMessage[];
  workflowSessionId?: string;
};

const newSession = (): ChatSession => ({
  id: `draft-${Date.now()}`,
  title: 'Nuova conversazione',
  updatedAt: new Date().toISOString(),
  messages: [],
});

const titleFrom = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 52) || 'Conversazione senza titolo';

export function AssistantView({ user, word = wordDocumentService }: { user: User; word?: WordDocumentService }) {
  const [selected, setSelected] = useState('');
  const [action, setAction] = useState<LexheroAction>('chat');
  const [prompt, setPrompt] = useState('');
  const [whole, setWhole] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession>(() => newSession());
  const [showSessions, setShowSessions] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [thinkingUpdates, setThinkingUpdates] = useState<string[]>([]);
  const [thinkingStartedAt, setThinkingStartedAt] = useState(0);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  const hasConversation = activeSession.messages.length > 0;
  const allSessions = useMemo(() => [activeSession, ...sessions.filter((item) => item.id !== activeSession.id)], [activeSession, sessions]);

  async function refreshSelection() {
    setSelectionLoading(true);
    setError('');
    try {
      setSelected(await word.getSelectedText());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossibile leggere la selezione');
    } finally {
      setSelectionLoading(false);
    }
  }

  async function revealSelection() {
    try { await word.revealText(selected); }
    catch (e) { setError(e instanceof Error ? e.message : 'Impossibile mostrare il testo nel documento'); }
  }

  async function loadSessions() {
    setHistoryLoading(true);
    try {
      const items = await api.history();
      const grouped = new Map<string, HistoryItem[]>();
      items.forEach((item) => grouped.set(item.session_id, [...(grouped.get(item.session_id) ?? []), item]));
      const historicSessions = [...grouped.entries()].map(([id, rows]): ChatSession => {
        const sorted = rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return {
          id,
          title: titleFrom(sorted[0]?.selected_text || sorted[0]?.content || 'Conversazione'),
          updatedAt: sorted.at(-1)?.created_at || new Date().toISOString(),
          workflowSessionId: id,
          messages: sorted.map((row) => ({
            id: row.id,
            role: 'assistant',
            response: {
              requestId: row.id,
              sessionId: row.session_id,
              answer: row.content,
              citations: row.citations || [],
              warnings: row.warnings || [],
              toolCalls: row.metadata?.toolCalls || [],
              metadata: { action: row.action, mcpUsed: false, webhookUsed: true },
            },
          })),
        };
      });
      setSessions((current) => [...current.filter((session) => session.id.startsWith('draft-')), ...historicSessions]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il caricamento delle conversazioni');
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewSession() {
    if (activeSession.messages.length) setSessions((items) => [activeSession, ...items.filter((item) => item.id !== activeSession.id)]);
    setActiveSession(newSession());
    setPrompt('');
    setError('');
    setShowSessions(false);
  }

  function openSession(session: ChatSession) {
    if (activeSession.messages.length) setSessions((items) => [activeSession, ...items.filter((item) => item.id !== activeSession.id)]);
    setActiveSession(session);
    setShowSessions(false);
    setError('');
  }

  useEffect(() => {
    refreshSelection();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = word.onSelectionChanged?.(() => {
      clearTimeout(timer);
      timer = setTimeout(refreshSelection, 180);
    });
    return () => { clearTimeout(timer); unsubscribe?.(); };
  }, [word]);

  useEffect(() => { void loadSessions(); }, []);

  useEffect(() => {
    if (!loading || !thinkingStartedAt) return;
    const tick = () => setThinkingSeconds(Math.floor((Date.now() - thinkingStartedAt) / 1000));
    tick(); const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [loading, thinkingStartedAt]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const requestText = prompt.trim() || selected.trim();
    if (!requestText) return;
    const userMessage: ConversationMessage = { id: `user-${Date.now()}`, role: 'user', content: requestText };
    const pendingSession = {
      ...activeSession,
      title: activeSession.messages.length ? activeSession.title : titleFrom(requestText),
      updatedAt: new Date().toISOString(),
      messages: [...activeSession.messages, userMessage],
    };
    setActiveSession(pendingSession);
    setPrompt('');
    setLoading(true);
    setThinkingStartedAt(Date.now());
    setThinkingSeconds(0);
    setThinkingUpdates(['Sto preparando il contesto per il workflow', 'Organizzo i passaggi rilevanti', 'Controllo coerenza e completezza', 'Verifico i punti che richiedono attenzione', 'Preparo una risposta chiara e utilizzabile', 'Finalizzo il risultato del workflow']);
    setError('');
    try {
      const metadata = await word.getMetadata();
      const payload: LexheroRequest = {
        action,
        prompt: prompt.trim() || undefined,
        selectedText: selected || undefined,
        document: metadata,
        options: { language: 'it', jurisdiction: 'IT', includeWholeDocument: whole },
        metadata: { workflowSessionId: activeSession.workflowSessionId },
      };
      if (whole) payload.documentText = await word.getWholeDocumentText();
      void api.thinking({ action, request: requestText }).then((result) => {
        if (result.updates.length) setThinkingUpdates(result.updates);
      }).catch(() => undefined);
      const response = await api.webhook(payload);
      setActiveSession((session) => ({
        ...session,
        id: response.sessionId || session.id,
        workflowSessionId: response.sessionId,
        updatedAt: new Date().toISOString(),
        messages: [...session.messages, { id: response.requestId, role: 'assistant', response }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Richiesta non riuscita');
    } finally {
      setLoading(false);
    }
  }

  async function analyzeDocument() {
    const requestText = 'Analizza il documento completo';
    const userMessage: ConversationMessage = { id: `user-${Date.now()}`, role: 'user', content: requestText };
    setActiveSession((session) => ({
      ...session,
      title: session.messages.length ? session.title : 'Analisi documento',
      updatedAt: new Date().toISOString(),
      messages: [...session.messages, userMessage],
    }));
    setLoading(true);
    setThinkingStartedAt(Date.now());
    setThinkingSeconds(0);
    setThinkingUpdates(['Leggo il documento completo', 'Identifico struttura e clausole', 'Valuto i rischi legali', 'Verifico la normativa rilevante', 'Preparo il report di analisi']);
    setError('');
    try {
      const [metadata, documentText] = await Promise.all([word.getMetadata(), word.getWholeDocumentText()]);
      if (!documentText.trim()) throw new Error('Il documento attivo è vuoto.');
      const payload: LexheroRequest = {
        action: 'analyzer',
        documentText,
        document: metadata,
        options: { language: 'it', jurisdiction: 'IT', includeWholeDocument: true },
        metadata: { workflowSessionId: activeSession.workflowSessionId },
      };
      const response = await api.webhook(payload);
      setActiveSession((session) => ({
        ...session,
        id: response.sessionId || session.id,
        workflowSessionId: response.sessionId,
        updatedAt: new Date().toISOString(),
        messages: [...session.messages, { id: response.requestId, role: 'assistant', response }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analisi del documento non riuscita');
    } finally {
      setLoading(false);
    }
  }

  return <div className="app-shell chat-shell">
    <header>
      <img src="/assets/lexhero-wordmark.png" alt="Lexhero" />
      <div className="header-actions">
        <button className="header-analyzer" onClick={analyzeDocument} disabled={loading} aria-label="Analizza il documento completo" title="Analyzer: analizza il documento completo"><FileSearch /></button>
        <button onClick={startNewSession} aria-label="Nuova conversazione" title="Nuova conversazione"><Plus /></button>
        <button className={showSessions ? 'active' : ''} onClick={() => setShowSessions(true)} aria-label="Conversazioni" title="Conversazioni"><History /></button>
        <button onClick={() => supabase.auth.signOut()} aria-label={`Esci da ${user.email}`}><LogOut /></button>
      </div>
    </header>
    {showSessions ? <main className="sessions-page">
      <div className="page-navigation"><button onClick={() => setShowSessions(false)}><ChevronLeft /> Chat</button></div>
      <div className="sessions-heading"><div><p className="eyebrow">QUESTO DOCUMENTO</p><h1>Conversazioni</h1><p>Continua una sessione o iniziane una nuova sul documento attivo.</p></div><button className="new-session" onClick={startNewSession}><Plus /> Nuova</button></div>
      <div className="session-list" aria-busy={historyLoading}>
        {allSessions.filter((session) => session.messages.length).map((session) => <button className={session.id === activeSession.id ? 'current' : ''} key={session.id} onClick={() => openSession(session)}>
          <MessageSquareText /><span><strong>{session.title}</strong><small>{session.messages.length} messaggi · {new Date(session.updatedAt).toLocaleDateString('it-IT')}</small></span>{session.id === activeSession.id && <em>Attiva</em>}
        </button>)}
        {!historyLoading && allSessions.every((session) => !session.messages.length) && <div className="empty"><MessageSquareText /> Nessuna conversazione per questo documento.</div>}
      </div>
    </main> : <main className="assistant-main">
      {hasConversation && <nav className="session-navigation" aria-label="Conversazione attiva"><button onClick={() => setShowSessions(true)}><ChevronLeft /></button><div><small>CONVERSAZIONE ATTIVA</small><strong>{activeSession.title}</strong></div><span><i /> In corso</span></nav>}
      <div className="conversation" aria-live="polite">
        {error && <p className="notice error" role="alert">{error}</p>}
        {!hasConversation ? <div className="conversation-empty"><Sparkles /><p className="eyebrow">LEXHERO AI</p><h2>Come posso aiutarti?</h2><span>{selected ? 'Il testo selezionato è pronto. Chiedi una revisione, una riscrittura o un’analisi.' : 'Seleziona un testo in Word oppure inizia con un prompt libero.'}</span></div> :
          <div className="message-list">{activeSession.messages.map((message) => message.role === 'user'
            ? <div className="user-message" key={message.id}>{message.content}</div>
            : <ResponsePanel key={message.id} response={message.response} word={word} />)}{loading && <ThinkingPanel updates={thinkingUpdates} seconds={thinkingSeconds} />}</div>}
      </div>
      <PromptComposer action={action} contextText={selected} loading={loading || selectionLoading} prompt={prompt} wholeDocument={whole} onActionChange={setAction} onClearContext={() => setSelected('')} onRevealContext={revealSelection} onPromptChange={setPrompt} onSubmit={submit} onWholeDocumentChange={setWhole} />
    </main>}
  </div>;
}

function ThinkingPanel({ updates, seconds }: { updates: string[]; seconds: number }) {
  const index = Math.min(updates.length - 1, Math.floor(seconds / 38));
  const elapsed = seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} sec`;
  return <section className="thinking-panel" role="status" aria-live="polite">
    <div className="thinking-head"><span className="thinking-mark"><Sparkles /></span><div><strong>Lexhero sta lavorando</strong><small>Il workflow può richiedere fino a 5 minuti</small></div><span className="thinking-time"><Clock3 /> {elapsed}</span></div>
    <div className="thinking-progress" aria-hidden="true"><i /></div>
    <p key={index}>{updates[index] || 'Sto elaborando la richiesta'}</p>
    <small className="thinking-note">Puoi lasciare aperto il pannello: la risposta apparirà appena n8n avrà terminato.</small>
  </section>;
}
