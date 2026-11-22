require('dotenv').config();
const express     = require('express');
const mongoose    = require('mongoose');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const fs          = require('fs');
const { ensureUploadDirectories } = require('./Backend/utils/uploadStorage');
const { validateEnvironment } = require('./Backend/config/environment');
const { protect, authorize } = require('./Backend/middleware/auth');

const app = express();
const clientOrigin=()=>{
  try { return process.env.CLIENT_URL ? new URL(process.env.CLIENT_URL).origin : 'http://localhost:5000'; }
  catch { return 'http://localhost:5000'; }
};

// ── Ensure directories exist ──────────────────────────────────
ensureUploadDirectories();

// ── Security Middleware ───────────────────────────────────────
app.set('trust proxy', process.env.TRUST_PROXY || 1);
app.use(helmet({
  crossOriginEmbedderPolicy:false,
  referrerPolicy:{policy:'no-referrer'},
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],
    scriptSrc:["'self'","'unsafe-inline'",'https://cdnjs.cloudflare.com'],
    scriptSrcAttr:["'unsafe-inline'"],
    styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],
    fontSrc:["'self'",'https://fonts.gstatic.com','data:'],
    imgSrc:["'self'",'data:','blob:'],
    connectSrc:["'self'"],
    objectSrc:["'none'"],
    baseUri:["'self'"],
    frameAncestors:["'none'"],
    formAction:["'self'"],
    ...(process.env.NODE_ENV==='production'?{upgradeInsecureRequests:[]}:{}),
  }},
}));
app.use(cors({
  origin:      (origin,callback) => {
    callback(null,!origin||origin===clientOrigin());
  },
  credentials: true,
  methods:     ['GET','POST','PUT','DELETE','PATCH'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Rate Limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success:false, message:'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success:false, message:'Too many login attempts. Please wait 15 minutes.' },
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/resend-otp', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ── Body Parsing ──────────────────────────────────────────────
app.use(compression());
// Verification and shared-document tokens are in legacy URL paths; never persist them in access logs.
morgan.token('safe-url',req=>String(req.originalUrl||'').split('?')[0].replace(/^\/(api\/auth\/verify-email|verify-email|reset-password|documents\/shared)\/[^/?]+/i,'/$1/[redacted]'));
app.use(morgan(':method :safe-url :status :res[content-length] - :response-time ms'));
app.use(express.json({ limit:'1mb' }));
app.use(express.urlencoded({ extended:false, limit:'64kb' }));

// ── Static Files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'Frontend/public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
}));
// Uploaded legal files are served only through ownership-checked document routes.

// ── API Routes ────────────────────────────────────────────────
app.get('/api/health/live', (req,res) => res.json({status:'ok',timestamp:Date.now(),uptime:process.uptime()}));
app.get('/api/health', (req,res) => {
  const ready=mongoose.connection.readyState===1;
  res.status(ready?200:503).json({status:ready?'ok':'not_ready',database:ready?'connected':'disconnected',timestamp:Date.now(),version:'1.0.0',uptime:process.uptime()});
});

app.use('/api/auth',          require('./Backend/routes/authRoutes'));
app.use('/api/users',         require('./Backend/routes/userRoutes'));
app.use('/api/lawyers',       require('./Backend/routes/lawyerRoutes'));
app.use('/api/cases',         require('./Backend/routes/caseRoutes'));
app.use('/api/appointments',  require('./Backend/routes/appointmentRoutes'));
app.use('/api/calendar',      require('./Backend/routes/calendarRoutes'));
app.use('/api/chatbot',       require('./Backend/routes/chatbotRoutes'));
app.use('/api/admin',         require('./Backend/routes/adminRoutes'));
app.use('/api/documents',     require('./Backend/routes/documentRoutes'));
app.use('/api/notifications', require('./Backend/routes/notificationRoutes'));
app.use('/api/messages',      require('./Backend/routes/messageRoutes'));

// ── Page Routes ───────────────────────────────────────────────
const V    = path.join(__dirname, 'Frontend/views');
const page = f => (req, res) => {
  const fp = path.join(V, f);
  if (!fs.existsSync(fp)) return res.status(404).sendFile(path.join(V,'shared/404.html'));
  res.sendFile(fp);
};
const pageRole = (...roles) => (req, res, next) => {
  const authResponse = { status() { return this; }, json() { res.redirect('/login'); } };
  protect(req, authResponse, () => {
    if (!roles.includes(req.user.role)) {
      const home = { citizen:'/dashboard/citizen', lawyer:'/dashboard/lawyer', admin:'/dashboard/admin' }[req.user.role] || '/login';
      return res.redirect(home);
    }
    next();
  });
};

// Auth
app.get('/',                     page('auth/landing.html'));
app.get('/login',                page('auth/login.html'));
app.get('/register',             page('auth/register.html'));

// Citizen
app.get('/dashboard/citizen',    pageRole('citizen'), page('citizen/dashboard.html'));
app.get('/cases',                pageRole('citizen','lawyer','admin'), page('citizen/cases.html'));
app.get('/chatbot',              pageRole('citizen'), page('citizen/chatbot.html'));
app.get('/lawyers',              pageRole('citizen'), page('citizen/lawyers.html'));
app.get('/documents',            pageRole('citizen'), page('citizen/documents.html'));
app.get('/documents/generate',   pageRole('citizen'), page('citizen/doc-generator.html'));
app.get('/similar-cases',        pageRole('citizen'), page('citizen/similar-cases.html'));
app.get('/legal-aid',            pageRole('citizen'), page('citizen/legal-aid.html'));
app.get('/profile',               pageRole('citizen','lawyer','admin'), page('shared/profile.html'));
app.get('/forgot-password',       page('shared/forgot-password.html'));

// Lawyer
app.get('/dashboard/lawyer',     pageRole('lawyer'), page('lawyer/dashboard.html'));
app.get('/lawyer/documents',     pageRole('lawyer'), page('lawyer/documents.html'));

// Admin
app.get('/dashboard/admin',      pageRole('admin'), page('admin/dashboard.html'));
app.get('/admin/login',           page('admin/login.html'));

// Shared
app.get('/appointments',         pageRole('citizen','lawyer','admin'), page('shared/appointments.html'));
app.get('/messages',             pageRole('citizen','lawyer'), page('shared/messages.html'));
app.get('/calendar',             pageRole('citizen','lawyer','admin'), page('shared/calendar.html'));
app.get('/documents/shared/:token', page('shared/doc-share.html'));
app.get('/verify-email/:token',    (req,res) => res.redirect(`/api/auth/verify-email/${req.params.token}`));
app.get('/reset-password/:token',   page('shared/reset-password.html'));

// 404
app.use((req, res) => res.status(404).sendFile(path.join(V, 'shared/404.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌', err.stack);
  res.status(err.status || 500).json({ success:false, message: process.env.NODE_ENV==='production' ? 'Something went wrong' : err.message });
});

const startServer=async()=>{
  const errors=validateEnvironment();
  if(errors.length)throw new Error(`Configuration error:\n- ${errors.join('\n- ')}`);
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000,socketTimeoutMS:45000});
  const port=Number(process.env.PORT||5000);
  const httpServer=await new Promise((resolve,reject)=>{
    const server=app.listen(port,'0.0.0.0',()=>resolve(server));
    server.once('error',reject);
  });
  console.log(`✅ MongoDB connected; LEXASSIST listening on port ${port} (${process.env.NODE_ENV||'development'})`);
  try { require('./Backend/utils/reminderCron').startReminders(); }
  catch(error) { console.warn('Reminder scheduler could not start:',error.message); }

  let stopping=false;
  const shutdown=async signal=>{
    if(stopping)return;stopping=true;
    console.log(`Received ${signal}; shutting down gracefully.`);
    const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
    await new Promise(resolve=>httpServer.close(resolve));
    await mongoose.disconnect();
    clearTimeout(timer);process.exit(0);
  };
  process.once('SIGINT',()=>shutdown('SIGINT'));
  process.once('SIGTERM',()=>shutdown('SIGTERM'));
  return httpServer;
};

if(require.main===module){
  startServer().catch(error=>{console.error(`❌ ${error.message}`);process.exitCode=1;});
}

module.exports={app,startServer};
