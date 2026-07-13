import { Check, Clipboard, ExternalLink, FileInput, Replace, Sparkles, TextCursorInput, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { LexheroResponse } from '../../types';
import type { WordDocumentService } from '../../services/word-document.service';

export function ResponsePanel({ response, word }: { response: LexheroResponse; word: WordDocumentService }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const parts = splitDocumentProposal(response.answer);
  const wordText = parts.proposal || response.answer;
  const visibleWarnings = response.warnings.filter((warning) => !/Contenuto generato automaticamente|non costituisce consulenza legale/i.test(warning));
  async function act(label: string, fn: () => Promise<void>) { try { await fn(); setStatus(label); } catch (e) { setStatus(e instanceof Error ? e.message : 'Operazione non riuscita'); } }
  return <section className="response" aria-live="polite">
    <div className="assistant-label"><Sparkles /> Lexhero AI</div>
    {parts.intro && <div className="answer"><ReactMarkdown components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}>{parts.intro}</ReactMarkdown></div>}
    {parts.proposal && <div className="document-proposal"><div className="proposal-heading"><div><p className="eyebrow">TESTO PROPOSTO</p><strong>Modifica pronta per Word</strong></div><span>Documento</span></div><div className="proposal-text"><ReactMarkdown>{parts.proposal}</ReactMarkdown></div><div className="action-grid proposal-actions"><button onClick={() => { navigator.clipboard.writeText(wordText); setCopied(true); }}>{copied ? <Check /> : <Clipboard />}{copied ? 'Copiato' : 'Copia'}</button><button onClick={() => act('Inserito al cursore', () => word.insertAtCursor(wordText))}><TextCursorInput />Inserisci</button><button onClick={() => act('Inserito dopo la selezione', () => word.insertAfterSelection(wordText))}><FileInput />Dopo</button><button className="replace" onClick={() => act('Selezione sostituita', () => word.replaceSelection(wordText))}><Replace />Sostituisci</button></div></div>}
    {parts.notes && <div className="chat-notes"><ReactMarkdown>{parts.notes}</ReactMarkdown></div>}
    {visibleWarnings.length > 0 && <div className="notices">{visibleWarnings.map((w, i) => <p className="notice warning" key={i}><TriangleAlert />{w}</p>)}</div>}
    {response.citations.length > 0 && <div><h3>Fonti</h3><div className="citations">{response.citations.map((c, i) => <article className="citation" key={c.id || i}><div><strong>{c.reference || c.title}</strong>{c.source && <small>{c.source}</small>}</div>{c.excerpt && <p>{c.excerpt}</p>}{c.url && <a href={c.url} target="_blank" rel="noreferrer">Apri fonte <ExternalLink /></a>}</article>)}</div></div>}
    {!parts.proposal && <div className="action-grid"><button onClick={() => { navigator.clipboard.writeText(wordText); setCopied(true); }}>{copied ? <Check /> : <Clipboard />}{copied ? 'Copiato' : 'Copia'}</button><button onClick={() => act('Inserito al cursore', () => word.insertAtCursor(wordText))}><TextCursorInput />Al cursore</button><button onClick={() => act('Inserito dopo la selezione', () => word.insertAfterSelection(wordText))}><FileInput />Dopo selezione</button><button className="replace" onClick={() => act('Selezione sostituita', () => word.replaceSelection(wordText))}><Replace />Sostituisci</button></div>}
    {status && <p className="inline-status" role="status">{status}</p>}
  </section>;
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
