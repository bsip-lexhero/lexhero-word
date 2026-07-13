import { Check, Clipboard, ExternalLink, FileInput, Replace, Sparkles, TextCursorInput, ThumbsDown, ThumbsUp, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { LexheroResponse } from '../../types';
import type { WordDocumentService } from '../../services/word-document.service';

export function ResponsePanel({ response, word }: { response: LexheroResponse; word: WordDocumentService }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [feedback, setFeedback] = useState<'up' | 'down' | ''>('');
  const parts = splitDocumentProposal(response.answer);
  const isAnalyzer = response.metadata.action === 'analyzer';
  const compliance = isAnalyzer ? extractCompliance(response.answer) : null;
  const wordText = parts.proposal || response.answer;
  const visibleWarnings = response.warnings.filter((warning) => !/Contenuto generato automaticamente|non costituisce consulenza legale/i.test(warning));
  async function act(label: string, fn: () => Promise<void>) { try { await fn(); setStatus(label); } catch (e) { setStatus(e instanceof Error ? e.message : 'Operazione non riuscita'); } }
  return <section className="response" aria-live="polite">
    <div className="assistant-label"><Sparkles /> Lexhero AI {compliance && <span className="compliance-badge"><small>Media conformità</small><strong>{compliance}%</strong></span>}</div>
    {parts.intro && <div className={`answer ${isAnalyzer ? 'analyzer-answer' : ''}`}><ReactMarkdown components={markdownComponents(word)}>{parts.intro}</ReactMarkdown></div>}
    {parts.proposal && <div className="document-proposal"><div className="proposal-heading"><div><p className="eyebrow">TESTO PROPOSTO</p><strong>Modifica pronta per Word</strong></div><span>Documento</span></div><div className="proposal-text"><ReactMarkdown>{parts.proposal}</ReactMarkdown></div></div>}
    {parts.notes && <div className="chat-notes"><ReactMarkdown>{parts.notes}</ReactMarkdown></div>}
    {visibleWarnings.length > 0 && <div className="notices">{visibleWarnings.map((w, i) => <p className="notice warning" key={i}><TriangleAlert />{w}</p>)}</div>}
    {response.citations.length > 0 && <div><h3>Fonti</h3><div className="citations">{response.citations.map((c, i) => <article className="citation" key={c.id || i}><div><strong>{c.reference || c.title}</strong>{c.source && <small>{c.source}</small>}</div>{c.excerpt && <p>{c.excerpt}</p>}{c.url && <a href={c.url} target="_blank" rel="noreferrer">Apri fonte <ExternalLink /></a>}</article>)}</div></div>}
    <div className="message-actions" aria-label="Azioni messaggio">
      <div className="message-action-group"><IconAction label={copied ? 'Copiato' : 'Copia risposta'} onClick={() => { navigator.clipboard.writeText(wordText); setCopied(true); }}>{copied ? <Check /> : <Clipboard />}</IconAction><IconAction label="Inserisci al cursore" onClick={() => act('Inserito al cursore', () => word.insertAtCursor(wordText))}><TextCursorInput /></IconAction><IconAction label="Inserisci dopo la selezione" onClick={() => act('Inserito dopo la selezione', () => word.insertAfterSelection(wordText))}><FileInput /></IconAction><IconAction label="Sostituisci la selezione" onClick={() => act('Selezione sostituita', () => word.replaceSelection(wordText))}><Replace /></IconAction></div>
      <div className="message-feedback" aria-label="Valuta risposta"><IconAction label="Risposta utile" active={feedback === 'up'} onClick={() => setFeedback(feedback === 'up' ? '' : 'up')}><ThumbsUp /></IconAction><IconAction label="Risposta non utile" active={feedback === 'down'} onClick={() => setFeedback(feedback === 'down' ? '' : 'down')}><ThumbsDown /></IconAction></div>
    </div>
    {status && <p className="inline-status" role="status">{status}</p>}
  </section>;
}

function IconAction({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? 'active' : ''} aria-label={label} title={label} onClick={onClick}>{children}<span role="tooltip">{label}</span></button>;
}

function extractCompliance(answer: string) {
  const match = answer.match(/Media\s+conformit[aà]\s*\(?\s*(\d{1,3})\s*%/i);
  return match ? Number(match[1]) : null;
}

function nodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (node && typeof node === 'object' && 'props' in node) return nodeText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  return '';
}

function markdownComponents(word: WordDocumentService) {
  return {
    a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
    strong: ({ children }: { children?: React.ReactNode }) => {
      const text = nodeText(children).trim();
      const risk = /(?:rischio\s*)?(alto|high)/i.test(text) ? 'high' : /(?:rischio\s*)?(medio|medium)/i.test(text) ? 'medium' : /(?:rischio\s*)?(basso|low)/i.test(text) ? 'low' : '';
      const article = /^(?:art\.?|clausola)\s*\d+/i.test(text);
      if (article) return <button className="document-jump" title="Vai a questa clausola nel documento" onClick={() => word.revealText(text)}><strong>{children}</strong></button>;
      return <strong className={risk ? `risk-label risk-${risk}` : undefined}>{children}</strong>;
    },
  };
}

export function splitDocumentProposal(answer: string) {
  const heading = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?Testo proposto(?:\*\*)?\s*:?[ \t]*(?:\n|$)/i;
  const match = heading.exec(answer);
  if (!match) return { intro: answer.trim(), proposal: '', notes: '' };
  const intro = answer.slice(0, match.index).trim();
  const tail = answer.slice(match.index + match[0].length);
  const noteHeading = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?(?:Note sintetiche|Note|Osservazioni|Motivazione)(?:\*\*)?\s*:?[ \t]*(?:\n|$)/i;
  const note = noteHeading.exec(tail);
  if (!note) return { intro, proposal: tail.trim(), notes: '' };
  return { intro, proposal: tail.slice(0, note.index).trim(), notes: tail.slice(note.index + note[0].length).trim() };
}
