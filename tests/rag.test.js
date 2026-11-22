const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rag = require('../Ai_Chatbot_Rag/utils/ragUtils');
const chatbot = require('../Backend/controllers/chatbotController');
let createdFilename;
const uploadsDir=path.join(__dirname,'../Ai_Chatbot_Rag/knowledge_base/uploads');

const invoke=(handler,req)=>new Promise(resolve=>{
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(data){resolve({status:this.statusCode,data});}};
  handler(req,res);
});

test('hybrid retrieval returns cited passages from the local legal library', () => {
  const result = rag.buildContext('What is Section 420 IPC and cheating?', 3);
  assert.ok(result.context.length > 0, 'retrieval should produce context');
  assert.ok(result.sources.includes('complete'), 'retrieval should expose the source label');
  assert.ok(result.evidence.length > 0 && result.evidence.length <= 3, 'evidence should be bounded to topK');
  assert.ok(result.evidence.some(item => item.source === 'ipc_complete.txt' && /420/.test(item.excerpt)), 'passage should identify its source and include the matched section');
  assert.ok(result.evidence.every(item => Number.isFinite(item.score) && item.excerpt.length <= 360));
});

test('legal assistant prompt avoids unsupported claims and requires source-grounded answers',()=>{
  const prompt=rag.buildSystemPrompt('');
  assert.match(prompt,/may be incomplete, outdated, or unverified/);
  assert.match(prompt,/Never fill gaps from memory or general legal knowledge/);
  assert.match(prompt,/Do not invent deadlines, penalties, procedures, outcomes, citations, or required actions/);
  assert.doesNotMatch(prompt,/thousands of Indian court cases|complete Indian Penal Code|general Indian law knowledge/);
});

test('knowledge source inventory reports real indexed files and read-only bundled sources', () => {
  const inventory = rag.listSources();
  assert.ok(inventory.stats.files > 0);
  assert.ok(inventory.stats.chunks > 0);
  assert.ok(inventory.sources.some(source => source.kind === 'bundled' && source.status === 'Indexed'));
  assert.ok(inventory.sources.every(source => ['bundled','uploaded'].includes(source.kind)));
  assert.ok(inventory.sources.every(source => Number.isInteger(source.chunks) && source.chunks >= 0));
});

test('admin source upload indexes the real text and remove refreshes the index', async t => {
  t.after(()=>{if(createdFilename){const file=path.join(uploadsDir,createdFilename);if(fs.existsSync(file))fs.unlinkSync(file);rag.invalidateIndex();}});
  const body='Section 420 IPC describes cheating and dishonest inducement to deliver property. This test source covers criminal law, legal remedies, the court process, and evidence.\n\nA citizen should preserve documents and seek legal guidance for advice specific to their facts.';
  const uploaded=await invoke(chatbot.uploadKBSource,{file:{originalname:'integration test source.txt',buffer:Buffer.from(body)}});
  assert.equal(uploaded.status,201);
  createdFilename=uploaded.data.data.filename;
  assert.ok(uploaded.data.data.chunks>0);
  const inventory=rag.listSources();
  assert.ok(inventory.sources.some(source=>source.kind==='uploaded'&&source.id===`uploads/${createdFilename}`&&source.chunks>0));
  const preview=await invoke(chatbot.previewKBSource,{params:{filename:createdFilename}});
  assert.equal(preview.status,200);
  assert.match(preview.data.data.content,/Section 420 IPC/);
  const removed=await invoke(chatbot.deleteKBSource,{params:{filename:createdFilename}});
  assert.equal(removed.status,200);
  assert.ok(!rag.listSources().sources.some(source=>source.id===`uploads/${createdFilename}`));
  createdFilename=undefined;
});
