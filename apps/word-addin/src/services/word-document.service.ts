export interface WordDocumentService { getSelectedText():Promise<string>; getWholeDocumentText():Promise<string>; getMetadata():Promise<{title?:string;url?:string}>; revealText(text:string):Promise<void>; onSelectionChanged?(handler:()=>void):()=>void; insertAtCursor(text:string):Promise<void>; insertAfterSelection(text:string):Promise<void>; replaceSelection(text:string):Promise<void> }
export class OfficeWordDocumentService implements WordDocumentService {
  private ensure(){if(typeof Word==='undefined')throw new Error('Apri Lexhero da Microsoft Word per usare il documento.');}
  async getSelectedText(){if(typeof Word==='undefined')return'';return Word.run(async c=>{const r=c.document.getSelection();r.load('text');await c.sync();return r.text.trim();});}
  async getWholeDocumentText(){this.ensure();return Word.run(async c=>{const b=c.document.body;b.load('text');await c.sync();return b.text;});}
  async getMetadata(){const document=typeof Office==='undefined'?undefined:Office.context?.document;if(!document)return{};return{title:document.url?.split('/').pop()||'Documento Word',url:document.url||undefined};}
  async revealText(text:string){this.ensure();const query=text.trim();if(!query)return;await Word.run(async c=>{const matches=c.document.body.search(query,{matchCase:true,matchWholeWord:false});matches.load('items');await c.sync();if(!matches.items.length)throw new Error('Il testo selezionato non è più presente nel documento.');matches.items[0].select('Select');await c.sync();});}
  onSelectionChanged(handler:()=>void){
    const document=typeof Office==='undefined'?undefined:Office.context?.document;
    if(!document?.addHandlerAsync||!document.removeHandlerAsync)return()=>undefined;
    const listener=()=>handler();
    document.addHandlerAsync(Office.EventType.DocumentSelectionChanged,listener);
    return()=>document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged,{handler:listener});
  }
  async insertAtCursor(text:string){this.ensure();await Word.run(async c=>{c.document.getSelection().insertText(text,Word.InsertLocation.replace);await c.sync();});}
  async insertAfterSelection(text:string){this.ensure();await Word.run(async c=>{c.document.getSelection().insertText(text,Word.InsertLocation.after);await c.sync();});}
  async replaceSelection(text:string){this.ensure();await Word.run(async c=>{c.document.getSelection().insertText(text,Word.InsertLocation.replace);await c.sync();});}
}
export const wordDocumentService:WordDocumentService=new OfficeWordDocumentService();
