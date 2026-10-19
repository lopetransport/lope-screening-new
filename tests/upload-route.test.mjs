import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPayloadFromClientToken } from '@vercel/blob/client';
import example from '../example-payload.json' with { type: 'json' };
import { signSession } from '../server/application.js';
import { createUploadHandler } from '../server/upload.js';

const documentId = '76a701f8-fb02-47a1-bbe8-c068cd5d3a40';
const env = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_teststore_not-a-real-store-secret', HUBSPOT_ACCESS_TOKEN: 'test-signing-secret' };
function event() {
 const a = structuredClone(example);a.documents[0].id=documentId;
 const signed=signSession(a,env.HUBSPOT_ACCESS_TOKEN);
 return {type:'blob.generate-client-token',payload:{pathname:`applications/${signed.applicationId}/${documentId}`,clientPayload:JSON.stringify({token:signed.token,documentId}),multipart:false}};
}
async function run(body, overrides={}) {
 const logs=[];
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.data=v;return this;}};
 await createUploadHandler({env,logger:{error:(...args)=>logs.push(args)},...overrides})({method:'POST',headers:{host:'example.com','content-type':'application/json'},url:'/api/upload',body},res);
 return {res,logs};
}
test('real SDK returns a scoped client token from the explicit read-write token without network access',async()=>{
 const body=event();const {res}=await run(body);
 assert.equal(res.code,200);assert.equal(res.data.type,'blob.generate-client-token');
 assert.ok(res.data.clientToken.startsWith('vercel_blob_client_teststore_'));
 const payload=getPayloadFromClientToken(res.data.clientToken);
 assert.equal(payload.pathname,body.payload.pathname);assert.equal(payload.maximumSizeInBytes,100);
 assert.deepEqual(payload.allowedContentTypes,['application/pdf']);assert.equal(payload.allowOverwrite,false);
 assert.equal(payload.onUploadCompleted,undefined);
 assert.ok(!JSON.stringify(res.data).includes(env.BLOB_READ_WRITE_TOKEN));
});
test('missing server token is reported without invoking the SDK',async()=>{
 const {res}=await run(event(),{env:{...env,BLOB_READ_WRITE_TOKEN:'   '},sdkHandleUpload:async()=>assert.fail('No credential was configured')});
 assert.equal(res.code,503);assert.equal(res.data.code,'BLOB_TOKEN_MISSING');
});

test('configured credential is forwarded to the SDK without application format assumptions',async()=>{
 for(const credential of ['provider-managed-token-format','vercel_blob_rw_store.with.dots_test-secret']) {
 let called=false;
 const {res}=await run(event(),{env:{...env,BLOB_READ_WRITE_TOKEN:`  ${credential}  `},sdkHandleUpload:async options=>{
 called=true;assert.equal(options.token,credential);
 return {type:'blob.generate-client-token',clientToken:'vercel_blob_client_scoped'};
 }});
 assert.equal(res.code,200);assert.equal(called,true);
 }
});

test('SDK-accepted credential is not rejected by our old store-ID character regex',async()=>{
 const {res}=await run(event(),{env:{...env,BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_store.with.dots_test-secret'}});
 assert.equal(res.code,200);
 assert.equal(getPayloadFromClientToken(res.data.clientToken).maximumSizeInBytes,100);
});

test('actual SDK credential rejection is distinct from an application format check and never exposes credentials',async()=>{
 const {res,logs}=await run(event(),{env:{...env,BLOB_READ_WRITE_TOKEN:'invalid-secret'}});
 assert.equal(res.code,503);assert.equal(res.data.code,'BLOB_SDK_CREDENTIAL_REJECTED');
 assert.ok(!JSON.stringify(res.data).includes('invalid-secret'));assert.ok(!JSON.stringify(logs).includes('invalid-secret'));
});

test('validates session before calling the SDK',async()=>{
 const body=event();body.payload.clientPayload=JSON.stringify({token:'forged',documentId});
 const {res}=await run(body,{sdkHandleUpload:async()=>assert.fail('SDK must not be called')});
 assert.equal(res.code,400);assert.equal(res.data.code,'UPLOAD_SESSION_INVALID');
});
test('passes configured token explicitly and does not register an unnecessary callback',async()=>{
 const {res}=await run(event(),{sdkHandleUpload:async options=>{
 assert.equal(options.token,env.BLOB_READ_WRITE_TOKEN);assert.equal(options.onUploadCompleted,undefined);
 const authorization=await options.onBeforeGenerateToken(options.body.payload.pathname,options.body.payload.clientPayload);
 assert.equal(authorization.maximumSizeInBytes,100);
 return {type:'blob.generate-client-token',clientToken:'vercel_blob_client_scoped'};
 }});assert.equal(res.code,200);
});
test('SDK errors and malformed SDK receipts return safe JSON failures',async()=>{
 for(const sdkHandleUpload of [async()=>{throw Error('private credential details');},async()=>({})]) {
 const {res,logs}=await run(event(),{sdkHandleUpload});assert.equal(res.code,502);assert.equal(res.data.success,false);
 assert.ok(!JSON.stringify(res.data).includes('private credential'));assert.ok(!JSON.stringify(logs).includes('private credential'));
 }
});
