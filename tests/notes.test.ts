import test from 'node:test';
import assert from 'node:assert/strict';
import { SiYuanNotes, parseNoteId } from '../src/platform/siyuan-notes';
const id='20260101000000-demo001';
test('note targets only accept SiYuan IDs, block links and references',()=>{
  for(const value of [id,`siyuan://blocks/${id}`,`((${id} '资料'))`])assert.equal(parseNoteId(value),id);
  for(const value of ['https://example.com',`siyuan://blocks/${id}?x=1`,`${id}' OR 1=1`])assert.throws(()=>parseNoteId(value));
});
test('open uses local session, validates target existence and opens only after successful resolution',async()=>{
  const opened:string[]=[];
  const bridge=new SiYuanNotes(value=>{opened.push(value);},async(url,options)=>{
    assert.equal(url,'/api/query/sql');assert.equal(options?.credentials,'same-origin');assert.match(String(options?.body),new RegExp(id));
    return new Response(JSON.stringify({code:0,data:[{id,content:'资料标题'}]}));
  });
  assert.equal((await bridge.resolve(id)).title,'资料标题');await bridge.open(id);assert.deepEqual(opened,[id]);
  const absent=new SiYuanNotes(()=>assert.fail('Missing note must not open'),async()=>new Response(JSON.stringify({code:0,data:[]})));
  await assert.rejects(absent.open(id),/不存在/);
});
test('destroy abort signal prevents host tab opening after delayed note lookup',async()=>{
  let release!:()=>void;const pending=new Promise<void>(resolve=>release=resolve);let opened=0;
  const bridge=new SiYuanNotes(()=>{opened++;},async()=>{await pending;return new Response(JSON.stringify({code:0,data:[{id,content:'迟到的笔记'}]}));});
  const controller=new AbortController();const opening=bridge.open(id,controller.signal);controller.abort();release();await opening;
  assert.equal(opened,0);
});
