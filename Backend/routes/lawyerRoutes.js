const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const credentialUpload=multer({
  storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=>['.pdf','.jpg','.jpeg','.png'].includes(require('path').extname(file.originalname).toLowerCase())?cb(null,true):cb(new Error('Upload a PDF, JPG, or PNG Bar Council document')),
});
const { getLawyers, getLawyerById, registerAsLawyer, updateLawyerProfile, getMyLawyerProfile, uploadCredential, addReview, getSpecializations } = require('../controllers/lawyerController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',                   getLawyers);
router.get('/specializations',    getSpecializations);
router.post('/register',          protect, authorize('citizen'), registerAsLawyer);
router.get('/profile',            protect, authorize('lawyer'), getMyLawyerProfile);
router.put('/profile',            protect, authorize('lawyer'), updateLawyerProfile);
router.post('/credentials',       protect, authorize('lawyer'), credentialUpload.single('credential'), uploadCredential);
router.get('/:id',                getLawyerById);
router.post('/:id/review',        protect, authorize('citizen'), addReview);

module.exports = router;
