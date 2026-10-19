import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

test('browser flow sends full application, uploads directly, and resumes failed uploads without dropping documents', async () => {
  const encode = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const model = await transformWithEsbuild(await readFile(new URL('../src/model.ts', import.meta.url), 'utf8'), 'model.ts');
  const modelUrl = encode(model.code);
  const helper = await transformWithEsbuild(await readFile(new URL('../src/submitApplication.ts', import.meta.url), 'utf8'), 'submitApplication.ts');
  const stub = encode('export async function put(...args) { return globalThis.__lopeTestUpload(...args); }');
  const code = helper.code.replace(/from ["']\.\/model["']/g, `from ${JSON.stringify(modelUrl)}`).replace(/from ["']@vercel\/blob\/client["']/g, `from ${JSON.stringify(stub)}`);
  const { submitApplication } = await import(encode(code));
  const { initialData } = await import(modelUrl);
  const data = { ...initialData(), fullName: 'Demo Hauler', idNumber: 'DEMO12345', email: 'demo@example.com', mobileNumber: '0821234567', accountNumber: '00000000', branchCode: '000000' };
  const documents = ['first', 'second'].map(name => ({ id: crypto.randomUUID(), type: 'Other Supporting Document', file: new File(['demo'], `${name}.pdf`, { type: 'application/pdf', lastModified: 1 }) }));
  const previousFetch = globalThis.fetch;
  const cache = { current: null };
  const requests = [];
  const uploads = [];
  let failSecond = true;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.method, 'POST');
      if (url === '/api/upload') {
        const event = JSON.parse(options.body);
        assert.equal(event.type, 'blob.generate-client-token');
        assert.equal(JSON.parse(event.payload.clientPayload).token, 'signed-token');
        return new Response(JSON.stringify({type:event.type,clientToken:'vercel_blob_client_test_scoped'}));
      }
      assert.equal(url, '/api/submit');
      const body = JSON.parse(options.body); requests.push(body);
      if (body.action === 'prepare') return new Response(JSON.stringify({ success: true, token: 'signed-token', applicationId: 'application-reference' }));
      assert.equal(body.application.applicant.idOrPassportNumber, 'DEMO12345');
      assert.equal(body.application.banking.accountNumber, '00000000');
      assert.equal(body.application.trucks.length, 1);
      assert.ok(body.application.documents.every(d => d.url.startsWith('https://store.public.blob.vercel-storage.com/')));
      return new Response(JSON.stringify({ success: true, applicationId: 'application-reference', documentsReceived: 2, emailNotification: 'not_configured' }));
    };
    globalThis.__lopeTestUpload = async (path, file, options) => {
      uploads.push(file.name);
      assert.equal(options.access, 'public');
      assert.equal(options.token, 'vercel_blob_client_test_scoped');
      if (file.name === 'second.pdf' && failSecond) { failSecond = false; throw Error('Simulated connection failure'); }
      return { url: `https://store.public.blob.vercel-storage.com/${path}-random` };
    };
    await assert.rejects(submitApplication(data, documents, cache, () => {}), /Simulated connection failure/);
    const receipt = await submitApplication(data, documents, cache, () => {});
    assert.equal(receipt.documentsReceived, 2);
    assert.deepEqual(uploads, ['first.pdf', 'second.pdf', 'second.pdf']);
    assert.deepEqual(requests.map(r => r.action), ['prepare', 'finalize']);
  } finally {
    globalThis.fetch = previousFetch;
    delete globalThis.__lopeTestUpload;
  }
});

test('browser surfaces upload API errors and rejects HTML instead of hiding token retrieval failures', async () => {
  const encode = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const model = await transformWithEsbuild(await readFile(new URL('../src/model.ts', import.meta.url), 'utf8'), 'model.ts');
  const modelUrl = encode(model.code);
  const helper = await transformWithEsbuild(await readFile(new URL('../src/submitApplication.ts', import.meta.url), 'utf8'), 'submitApplication.ts');
  const stub = encode('export async function put() { throw new Error("Blob must not be called without a client token"); }');
  const code = helper.code.replace(/from ["']\.\/model["']/g, `from ${JSON.stringify(modelUrl)}`).replace(/from ["']@vercel\/blob\/client["']/g, `from ${JSON.stringify(stub)}`);
  const { submitApplication } = await import(encode(code));
  const { initialData } = await import(modelUrl);
  const documents = [{id:crypto.randomUUID(),type:'Other Supporting Document',file:new File(['test'],'test.pdf',{type:'application/pdf'})}];
  const oldFetch = globalThis.fetch;
  try {
    for (const [status, body, expected] of [
      [503,JSON.stringify({code:'BLOB_TOKEN_MISSING',message:'Set BLOB_READ_WRITE_TOKEN and redeploy.'}),/BLOB_READ_WRITE_TOKEN/],
      [400,JSON.stringify({code:'UPLOAD_SESSION_INVALID',message:'Your upload session expired.'}),/session expired/],
      [200,'<html>Website instead of API response</html>',/returns JSON/],
    ]) {
      const cache={current:null};
      globalThis.fetch=async url=>url==='/api/submit'?new Response(JSON.stringify({success:true,token:'session',applicationId:'reference'})):new Response(body,{status});
      await assert.rejects(submitApplication(initialData(),documents,cache,()=>{}),expected);
      if(status===400)assert.equal(cache.current,null);
    }
  } finally { globalThis.fetch=oldFetch; }
});
