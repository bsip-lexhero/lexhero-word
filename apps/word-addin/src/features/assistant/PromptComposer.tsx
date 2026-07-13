import { FormEvent, useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, CircleHelp, FileText, Gavel, Handshake, Landmark, Lightbulb, LoaderCircle, Puzzle, Send, Sparkles, X } from 'lucide-react';
import type { LexheroAction } from '../../types';

const tools: { value: LexheroAction; label: string; hint: string; icon: typeof Sparkles; dividerBefore?: boolean }[] = [
  { value: 'chat', label: 'Chat', hint: 'Domande rapide e raccolta informazioni', icon: Sparkles },
  { value: 'atto', label: 'Atti legali', hint: 'Generazione di atti processuali', icon: Gavel },
  { value: 'contratto', label: 'Contratti', hint: 'Redazione e revisione contrattuale', icon: Handshake },
  { value: 'parere', label: 'Pareri', hint: 'Analisi giuridica formale', icon: Lightbulb },
  { value: 'clausola', label: 'Clausole', hint: 'Creazione di clausole specifiche', icon: Puzzle },
  { value: 'trova_norme', label: 'Trova norme', hint: 'Testo di leggi e articoli', icon: Landmark, dividerBefore: true },
  { value: 'trova_giurisprudenza', label: 'Giurisprudenza', hint: 'Sentenze e orientamenti', icon: BookOpen },
  { value: 'trova_news', label: 'News e dottrina', hint: 'Aggiornamenti e contributi giuridici', icon: FileText },
];

export function PromptComposer({
  action,
  contextText,
  loading,
  prompt,
  wholeDocument,
  onActionChange,
  onClearContext,
  onRevealContext,
  onPromptChange,
  onSubmit,
  onWholeDocumentChange,
}: {
  action: LexheroAction;
  contextText: string;
  loading: boolean;
  prompt: string;
  wholeDocument: boolean;
  onActionChange: (action: LexheroAction) => void;
  onClearContext: () => void;
  onRevealContext: () => void;
  onPromptChange: (value: string) => void;
  onSubmit: (event?: FormEvent) => void;
  onWholeDocumentChange: (checked: boolean) => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedTool = tools.find((tool) => tool.value === action) ?? tools[0];
  const ToolIcon = selectedTool.icon;
  const hasSelectedMode = action !== 'chat';
  const canSubmit = Boolean(prompt.trim() || contextText.trim() || wholeDocument);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 180 ? 'auto' : 'hidden';
  }, [prompt]);

  return <div className="prompt-dock">
    <form className="prompt-box" onSubmit={onSubmit}>
      {contextText.trim() && <div className="prompt-context">
        <button className="context-jump" type="button" onClick={onRevealContext} aria-label="Mostra il testo selezionato nel documento" title="Mostra nel documento">
          <span>{contextText}</span>
        </button>
        <button type="button" onClick={onClearContext} aria-label="Rimuovi il testo selezionato dal contesto" title="Rimuovi contesto"><X /></button>
      </div>}
      <textarea
        ref={textareaRef}
        rows={1}
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSubmit(); }}
        placeholder={contextText ? "Chiedi all'AI di lavorare sul testo selezionato…" : 'Chiedi a Lexhero di analizzare, riscrivere o cercare…'}
        aria-label="Istruzione per Lexhero"
      />
      <div className="prompt-toolbar">
        <div className="prompt-tools">
          <div className="tool-picker">
            {hasSelectedMode ? <div className="tool-badge">
              <button className="tool-badge-main" type="button" onClick={() => setToolsOpen((open) => !open)} aria-expanded={toolsOpen} aria-haspopup="menu">
                <ToolIcon /><span>{selectedTool.label}</span><ChevronDown className={toolsOpen ? 'rotated' : ''} />
              </button>
              <button className="tool-badge-clear" type="button" onClick={() => { onActionChange('chat'); setToolsOpen(false); }} aria-label={`Rimuovi modalità ${selectedTool.label}`} title="Rimuovi modalità"><X /></button>
            </div> : <button className="tool-trigger" type="button" onClick={() => setToolsOpen((open) => !open)} aria-expanded={toolsOpen} aria-haspopup="menu">
              <Sparkles /><span>Strumenti</span><ChevronDown className={toolsOpen ? 'rotated' : ''} />
            </button>}
            {toolsOpen && <div className="tool-menu" role="menu">
              <p>Strumenti</p>
              {tools.map((tool) => { const Icon = tool.icon; return <div key={tool.value}>
                {tool.dividerBefore && <hr />}
                <button type="button" role="menuitemradio" aria-checked={tool.value === action} onClick={() => { onActionChange(tool.value); setToolsOpen(false); }}>
                  <Icon /><span><strong>{tool.label}</strong><small>{tool.hint}</small></span>
                </button>
              </div>; })}
            </div>}
          </div>
        </div>
        <div className="prompt-actions">
          <div className="fullpage-control">
            <label className="whole-document"><span>Documento intero</span><input type="checkbox" role="switch" aria-label="Usa il documento intero" checked={wholeDocument} onChange={(event) => onWholeDocumentChange(event.target.checked)} /><i aria-hidden="true" /></label>
            <span className="fullpage-help" tabIndex={0} aria-label="Oltre alla selezione, verrà inviato come contesto l’intero documento.">
              <CircleHelp aria-hidden="true" />
              <span role="tooltip">Oltre alla selezione, verrà inviato come contesto l’intero documento.</span>
            </span>
          </div>
          <button className="send-action" disabled={loading || !canSubmit} aria-label={loading ? 'Elaborazione' : 'Invia'} title="Invia">
            {loading ? <LoaderCircle className="spin" /> : <Send />}
          </button>
        </div>
      </div>
    </form>
  </div>;
}
