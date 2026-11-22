const test=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const path=require('node:path');
const {validateEnvironment}=require('../Backend/config/environment');

const productionEnvironment=()=>({
  NODE_ENV:'production',PORT:'5000',MONGO_URI:'mongodb://127.0.0.1:27017/lexassist',
  JWT_SECRET:'j'.repeat(48),OTP_PEPPER:'o'.repeat(48),CLIENT_URL:'https://lexassist.example',
  EMAIL_USER:'mailer@lexassist.example',EMAIL_PASS:'real-smtp-password',
  UPLOAD_DIR:path.join(os.tmpdir(),'lexassist-production-uploads'),LEGAL_CONTENT_REVIEWED:'true',LEGAL_CONTENT_REVIEW_DATE:'2026-11-22',
});

test('production configuration requires HTTPS, mail delivery, strong keys, and an absolute upload mount',()=>{
  assert.deepEqual(validateEnvironment(productionEnvironment()),[]);
  const invalid={...productionEnvironment(),CLIENT_URL:'http://lexassist.example',JWT_SECRET:'short',EMAIL_PASS:'replace_with_smtp_password',UPLOAD_DIR:'./uploads',LEGAL_CONTENT_REVIEWED:'false'};
  const errors=validateEnvironment(invalid);
  assert(errors.some(error=>error.includes('HTTPS')));
  assert(errors.some(error=>error.includes('JWT_SECRET')));
  assert(errors.some(error=>error.includes('EMAIL_USER')));
  assert(errors.some(error=>error.includes('absolute path')));
  assert(errors.some(error=>error.includes('LEGAL_CONTENT_REVIEW')));
});

test('example secret placeholders are rejected before the app can start',()=>{
  const env=productionEnvironment();env.JWT_SECRET='replace_with_a_unique_random_value_of_at_least_32_characters';
  assert(validateEnvironment(env).some(error=>error.includes('placeholder')));
});

test('server separates liveness from database readiness',async()=>{
  const {app}=require('../server');
  const server=await new Promise(resolve=>{const http=app.listen(0,'127.0.0.1',()=>resolve(http));});
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const landing=await fetch(base+'/');
    assert.equal(landing.status,200);assert.match(await landing.text(),/Legal clarity/);
    const live=await fetch(`${base}/api/health/live`);
    assert.equal(live.status,200);assert.equal((await live.json()).status,'ok');
    const ready=await fetch(`${base}/api/health`);
    assert.equal(ready.status,503);assert.equal((await ready.json()).database,'disconnected');
    const protectedPage=await fetch(base+'/dashboard/citizen',{redirect:'manual'});
    assert.equal(protectedPage.status,302);assert.equal(protectedPage.headers.get('location'),'/login');
  }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
