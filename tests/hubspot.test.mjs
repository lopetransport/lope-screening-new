import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../server/hubspot.js';
const body={fullName:'Demo van Example',email:'demo@example.com',phone:'+27821234567',company:'Demo Fleet',consents:{terms:true,processing:true,contact:true}};
async function run(fetchContact, overrides={}, token='test-token') {
 const req={method:'POST',headers:{host:'example.com',origin:'https://example.com','content-type':'application/json'},body,...overrides};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.data=v;return this;}};
 await createHandler({fetchContact,getToken:()=>token,logger:{error(){}}})(req,res);return res;
}
test('HubSpot mapping and authorization use only the five intended properties',async()=>{
 const res=await run(async(url,options)=>{assert.equal(url,'https://api.hubapi.com/crm/v3/objects/contacts');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(options.body),{properties:{email:'demo@example.com',firstname:'Demo',lastname:'van Example',phone:'+27821234567',company:'Demo Fleet'}});return new Response(JSON.stringify({id:'123'}),{status:201});});
 assert.equal(res.code,200);assert.deepEqual(res.data,{success:true,applicationId:'123'});assert.equal(res.headers['Content-Type'],'application/json; charset=utf-8');
});
test('HTTP 200 is accepted',async()=>{assert.equal((await run(async()=>new Response('{"id":"123"}',{status:200}))).code,200);});
test('missing token, invalid fields, missing consent and foreign origin never call HubSpot',async()=>{
 const noCall=async()=>{assert.fail('Unexpected HubSpot call');};
 assert.equal((await run(noCall,{},'')).code,503);
 assert.equal((await run(noCall,{body:{...body,email:'invalid'}})).code,400);
 assert.equal((await run(noCall,{body:{...body,consents:{}}})).code,400);
 assert.equal((await run(noCall,{headers:{host:'example.com',origin:'https://foreign.example','content-type':'application/json'}})).code,403);
 assert.equal((await run(noCall,{method:'GET'})).code,405);
});
test('duplicate, rate-limit, upstream failure and network errors are clear and sanitized',async()=>{
 for(const [upstream,expected] of [[409,409],[429,429],[401,502],[500,502]]){const r=await run(async()=>new Response('private upstream details',{status:upstream}));assert.equal(r.code,expected);assert.ok(r.data.message);assert.ok(!r.data.message.includes('private upstream'));}
 const r=await run(async()=>{throw Error('private network details');});assert.equal(r.code,502);assert.ok(!r.data.message.includes('private network'));
});
test('malformed receipt is not treated as success',async()=>{assert.equal((await run(async()=>new Response('{}',{status:201}))).code,502);});

test('upstream errors log status and correlation without contact data or tokens',async()=>{
 const entries=[];
 const req={method:'POST',headers:{host:'example.com','content-type':'application/json'},body};
 const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
 await createHandler({getToken:()=>'test-token',logger:{error:(...args)=>entries.push(args)},fetchContact:async()=>new Response(JSON.stringify({message:'private upstream details',correlationId:'abc-123'}),{status:400})})(req,res);
 assert.equal(res.code,400);assert.equal(res.data.success,false);
 assert.deepEqual(entries,[['HubSpot contact submission failed',{status:400,correlationId:'abc-123'}]]);
 assert.ok(!JSON.stringify(entries).includes(body.email));assert.ok(!JSON.stringify(entries).includes('test-token'));
});

test('JSON string body is parsed and malformed JSON returns an error',async()=>{
 assert.equal((await run(async()=>new Response('{"id":"123"}',{status:201}),{body:JSON.stringify(body)})).data.success,true);
 assert.equal((await run(async()=>{assert.fail('Unexpected upstream call');},{body:'{invalid'})).code,400);
});
