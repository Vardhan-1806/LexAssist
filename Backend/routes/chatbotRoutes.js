const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const rateLimit=require('express-rate-limit');
const path    = require('path');
const { sendMessage, getChatHistory, deleteSession, searchKB, analyzeDocument, getKBStats, getKBSources, previewKBSource, uploadKBSource, deleteKBSource } = require('../controllers/chatbotController');
const { protect, authorize } = require('../middleware/auth');
const { temporaryDirectory } = require('../utils/uploadStorage');

const externalAIQuota=rateLimit({
  windowMs:24*60*60*1000,
  limit:Math.max(1,Number.parseInt(process.env.AI_REQUESTS_PER_DAY,10)||30),
  keyGenerator:req=>String(req.user.id),
  standardHeaders:true,legacyHeaders:false,
  handler:(req,res)=>res.status(429).json({success:false,message:'The daily external AI limit is reached. Uncheck OpenAI processing to continue with local retrieval.'}),
});
const quotaWhenConsented=(req,res,next)=>{
  const consent=req.is('multipart/form-data')?String(req.body.externalAIConsent||'').toLowerCase()==='true':req.body.externalAIConsent===true;
  return consent&&process.env.OPENAI_API_KEY&&!process.env.OPENAI_API_KEY.includes('your_openai_key')?externalAIQuota(req,res,next):next();
};

const upload = multer({
  dest: temporaryDirectory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.txt'];
    allowed.includes(path.extname(file.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('Only PDF and TXT files are supported'));
  }
});
const knowledgeUpload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:2*1024*1024},
  fileFilter:(req,file,cb)=>['.txt','.md'].includes(path.extname(file.originalname).toLowerCase())?cb(null,true):cb(new Error('Knowledge sources must be TXT or Markdown files')),
});
const blockProductionKnowledgeUpload=(req,res,next)=>process.env.NODE_ENV==='production'
  ? res.status(403).json({success:false,message:'Legal library changes are disabled in production until source review and approval tracking are available.'})
  : next();

router.post('/message',              protect, quotaWhenConsented, sendMessage);
router.get('/history',               protect, getChatHistory);
router.get('/search',                protect, searchKB);
router.get('/stats',                 protect, authorize('admin'), getKBStats);
router.get('/sources',               protect, authorize('admin'), getKBSources);
router.get('/sources/:filename/preview',protect, authorize('admin'), previewKBSource);
router.post('/sources',              protect, authorize('admin'), blockProductionKnowledgeUpload, knowledgeUpload.single('source'), uploadKBSource);
router.delete('/sources/:filename', protect, authorize('admin'), blockProductionKnowledgeUpload, deleteKBSource);
router.post('/analyze-doc',          protect, upload.single('document'), quotaWhenConsented, analyzeDocument);
router.delete('/history/:sessionId', protect, deleteSession);

module.exports = router;
