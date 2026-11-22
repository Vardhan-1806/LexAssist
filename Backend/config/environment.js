const path=require('path');

const validateEnvironment = (env=process.env) => {
  const errors=[];
  const production=env.NODE_ENV==='production';
  if(!env.MONGO_URI)errors.push('MONGO_URI is required');
  if(!env.JWT_SECRET)errors.push('JWT_SECRET is required');
  if(!env.OTP_PEPPER)errors.push('OTP_PEPPER is required');
  for(const name of ['JWT_SECRET','OTP_PEPPER']) {
    if(env[name]&&env[name].length<32)errors.push(`${name} must be at least 32 characters`);
    if(env[name]&&/replace_with|change_me|changeme/i.test(env[name]))errors.push(`${name} still contains the example placeholder`);
  }
  const port=Number(env.PORT||5000);
  if(!Number.isInteger(port)||port<1||port>65535)errors.push('PORT must be a valid TCP port');
  if(env.EMAIL_PORT&&(!Number.isInteger(Number(env.EMAIL_PORT))||Number(env.EMAIL_PORT)<1||Number(env.EMAIL_PORT)>65535))errors.push('EMAIL_PORT must be a valid TCP port');
  if(env.AI_REQUESTS_PER_DAY&&(!Number.isInteger(Number(env.AI_REQUESTS_PER_DAY))||Number(env.AI_REQUESTS_PER_DAY)<1||Number(env.AI_REQUESTS_PER_DAY)>1000))errors.push('AI_REQUESTS_PER_DAY must be between 1 and 1000');

  if(production){
    if(env.ALLOW_DEV_OTP==='true')errors.push('ALLOW_DEV_OTP must be disabled in production');
    if(env.ALLOW_ADMIN_BOOTSTRAP==='true')errors.push('Remove ALLOW_ADMIN_BOOTSTRAP before starting the production web service');
    if(!env.CLIENT_URL)errors.push('CLIENT_URL is required in production');
    else { try { const url=new URL(env.CLIENT_URL);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash)errors.push('CLIENT_URL must be an HTTPS origin without a path or query'); } catch { errors.push('CLIENT_URL must be a valid HTTPS URL'); } }
    if(!env.EMAIL_USER||!env.EMAIL_PASS||env.EMAIL_USER.includes('example.com')||/your-smtp-password|replace_with/i.test(env.EMAIL_PASS||''))errors.push('Set real EMAIL_USER and EMAIL_PASS values in production so account verification can be delivered');
    if(!env.UPLOAD_DIR||!path.isAbsolute(env.UPLOAD_DIR))errors.push('UPLOAD_DIR must be an absolute path on persistent storage in production');
    if(env.LEGAL_CONTENT_REVIEWED!=='true')errors.push('Set LEGAL_CONTENT_REVIEWED=true only after qualified review of every legal source and user-facing legal template');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(env.LEGAL_CONTENT_REVIEW_DATE||''))errors.push('LEGAL_CONTENT_REVIEW_DATE must record the qualified legal-content review date (YYYY-MM-DD)');
  }
  return errors;
};

module.exports={validateEnvironment};
