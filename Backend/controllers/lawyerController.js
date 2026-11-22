const Lawyer = require('../models/Lawyer');
const User   = require('../models/User');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const { sendNewLawyerAlert } = require('../utils/emailService');
const { credentialDirectory, credentialPath }=require('../utils/uploadStorage');
const { Review } = require('../models/Extras');

// @route GET /api/lawyers
exports.getLawyers = async (req, res) => {
  try {
    const { specialization, city, minExp, maxFee, search, page = 1, limit = 12 } = req.query;
    const filter = { isVerified: true };

    const allowedSpecializations=['Criminal','Civil','Family','Corporate','Property','Labour','Cyber','Taxation','Constitutional','Environmental','Other'];
    if (specialization && allowedSpecializations.includes(specialization)) filter.specializations = { $in: [specialization] };
    const escapeRegex=value=>String(value).slice(0,60).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if (city) filter['location.city'] = new RegExp(escapeRegex(city), 'i');
    if (minExp && Number.isFinite(Number(minExp))) filter.experience = { $gte: Math.min(60,Math.max(0,Number(minExp))) };
    if (maxFee && Number.isFinite(Number(maxFee))) filter.consultationFee = { $lte: Math.max(0,Number(maxFee)) };
    if (search) {
      const userMatches=await User.find({name:new RegExp(escapeRegex(search),'i'),role:'lawyer'}).select('_id').limit(50);
      filter.$or=[{user:{$in:userMatches.map(user=>user._id)}},{barCouncilId:new RegExp(escapeRegex(search),'i')},{bio:new RegExp(escapeRegex(search),'i')}];
    }
    const pageNumber=Math.max(1,parseInt(page,10)||1),pageSize=Math.min(50,Math.max(1,parseInt(limit,10)||12));

    const lawyers = await Lawyer.find(filter)
      .select('-credentialDocuments -verificationHistory -rejectReason -rejectedAt')
      .populate('user', 'name profilePhoto')
      .sort('-rating -totalReviews')
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    const total = await Lawyer.countDocuments(filter);

    res.json({ success: true, count: lawyers.length, total, pages: Math.ceil(total / pageSize), data: lawyers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/lawyers/:id
exports.getLawyerById = async (req, res) => {
  try {
    const lawyer = await Lawyer.findOne({_id:req.params.id,isVerified:true}).select('-credentialDocuments -verificationHistory -rejectReason -rejectedAt').populate('user', 'name profilePhoto');
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found' });

    const reviews = await Review.find({ lawyer: lawyer.user })
      .populate('citizen', 'name profilePhoto')
      .sort('-createdAt')
      .limit(10);

    res.json({ success: true, data: { ...lawyer.toObject(), reviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/lawyers/register
exports.registerAsLawyer = async (req, res) => {
  try {
    const existing = await Lawyer.findOne({ user: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Already registered as lawyer' });

    const lawyer = await Lawyer.create({
      user:req.user.id,
      barCouncilId:String(req.body.barCouncilId || '').trim().slice(0,80),
      specializations:Array.isArray(req.body.specializations) ? req.body.specializations.slice(0,8) : [],
      experience:Math.min(60,Math.max(0,Number(req.body.experience)||0)),
      bio:String(req.body.bio || '').slice(0,2000),
      isVerified:false,
    });
    await User.findByIdAndUpdate(req.user.id, { role: 'lawyer' });

    // Notify all admins by email
    const admins = await User.find({ role: 'admin' }).select('_id email');
    for (const admin of admins) {
      sendNewLawyerAlert(admin.email,req.user.name,lawyer.barCouncilId,req.user.email).catch(console.error);
    }

    res.status(201).json({ success: true, data: lawyer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/lawyers/profile
exports.updateLawyerProfile = async (req, res) => {
  try {
    const allowed = ['specializations','experience','bio','education','languages','location','consultationFee','availability'];
    const updates = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key,req.body[key]]));
    if (updates.availability !== undefined) {
      const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
      if (!Array.isArray(updates.availability) || updates.availability.length>7 || updates.availability.some(item=>!item || !days.includes(item.day) || !validTime(item.startTime) || !validTime(item.endTime) || item.startTime>=item.endTime))
        return res.status(400).json({success:false,message:'Availability must contain valid weekdays and increasing 24-hour times'});
      updates.availability=updates.availability.map(item=>({day:item.day,startTime:item.startTime,endTime:item.endTime,isAvailable:item.isAvailable!==false}));
    }
    const lawyer = await Lawyer.findOneAndUpdate({ user:req.user.id }, updates, { new:true, runValidators:true });
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer profile not found' });
    res.json({ success: true, data: lawyer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyLawyerProfile = async (req, res) => {
  try {
    const lawyer=await Lawyer.findOne({user:req.user.id}).select('barCouncilId availability specializations experience bio consultationFee isVerified isRejected rejectReason verifiedAt rejectedAt credentialDocuments');
    if (!lawyer) return res.status(404).json({success:false,message:'Lawyer profile not found'});
    res.json({success:true,data:lawyer});
  } catch (err) { res.status(500).json({success:false,message:err.message}); }
};

exports.uploadCredential=async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({success:false,message:'Choose a credential document to upload'});
    const lawyer=await Lawyer.findOne({user:req.user.id});
    if(!lawyer)return res.status(404).json({success:false,message:'Lawyer profile not found'});
    if(lawyer.isVerified)return res.status(409).json({success:false,message:'Verified profiles cannot replace review documents from this screen'});
    if((lawyer.credentialDocuments||[]).length>=5)return res.status(400).json({success:false,message:'A maximum of five credential files can be submitted'});
    const original=path.basename(String(req.file.originalname||'credential').replace(/\\/g,'/')).replace(/[\\\r\n]/g,'_').slice(0,160);
    const ext=path.extname(original).toLowerCase(),bytes=req.file.buffer;
    const signatures={'.pdf':bytes.subarray(0,5).toString()==='%PDF-','.png':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'.jpg':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,'.jpeg':bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff};
    if(!signatures[ext])return res.status(400).json({success:false,message:'The file content does not match its PDF, JPG, or PNG extension'});
    fs.mkdirSync(credentialDirectory,{recursive:true});
    const fileName=`${crypto.randomBytes(18).toString('hex')}${ext}`;
    fs.writeFileSync(credentialPath(fileName),bytes,{flag:'wx'});
    const wasRejected=lawyer.isRejected;
    lawyer.credentialDocuments.push({originalName:original,fileName,fileType:ext==='.pdf'?'application/pdf':ext==='.png'?'image/png':'image/jpeg',fileSize:bytes.length,uploadedAt:new Date()});
    if(wasRejected){lawyer.isRejected=false;lawyer.rejectReason=undefined;lawyer.verificationHistory.push({action:'resubmitted',by:req.user.id,reason:'Additional credential document submitted'});}
    await lawyer.save();
    res.status(201).json({success:true,message:'Credential document submitted for admin review',data:{name:original,fileSize:bytes.length,count:lawyer.credentialDocuments.length}});
  }catch(err){res.status(500).json({success:false,message:'Could not save the credential document'});}
};

// @route POST /api/lawyers/:id/review
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const profile = await Lawyer.findOne({_id:req.params.id,isVerified:true});
    if (!profile) return res.status(404).json({success:false,message:'Verified lawyer not found'});
    const existing = await Review.findOne({ lawyer: profile.user, citizen: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Already reviewed this lawyer' });

    const Appointment=require('../models/Appointment');
    const Case=require('../models/Case');
    const completedConsultation=await Appointment.exists({citizen:req.user.id,lawyer:profile.user,status:'Completed'});
    const closedCase=await Case.exists({citizen:req.user.id,lawyer:profile.user,status:'Closed'});
    if (!completedConsultation && !closedCase) return res.status(403).json({success:false,message:'A completed consultation or closed case is required before reviewing'});
    if (!Number.isInteger(Number(rating)) || rating<1 || rating>5) return res.status(400).json({success:false,message:'Rating must be a whole number from 1 to 5'});

    const review = await Review.create({ lawyer: profile.user, citizen: req.user.id, rating, comment:String(comment||'').slice(0,1200) });

    const all = await Review.find({ lawyer: profile.user });
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await Lawyer.findOneAndUpdate({ _id:profile._id }, { rating: avg.toFixed(1), totalReviews: all.length });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/lawyers/specializations
exports.getSpecializations = (req, res) => {
  const specs = ['Criminal', 'Civil', 'Family', 'Corporate', 'Property', 'Labour', 'Cyber', 'Taxation', 'Constitutional', 'Environmental', 'Other'];
  res.json({ success: true, data: specs });
};
