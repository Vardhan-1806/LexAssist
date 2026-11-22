const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Case = require('../models/Case');
const { Notification, MessageThread, Message } = require('../models/Extras');
const { protect } = require('../middleware/auth');

router.use(protect);

async function mayMessage(firstId, secondId) {
  const users = await mongoose.model('User').find({_id:{$in:[firstId,secondId]}}).select('_id role');
  if (users.length !== 2 || users.some(user => !['citizen','lawyer'].includes(user.role))) return false;
  const citizen = users.find(user => user.role === 'citizen');
  const lawyer = users.find(user => user.role === 'lawyer');
  if (!citizen || !lawyer) return false;
  const [caseExists, appointmentExists] = await Promise.all([
    Case.exists({citizen:citizen._id,lawyer:lawyer._id}),
    Appointment.exists({citizen:citizen._id,lawyer:lawyer._id,status:{$in:['Pending','Confirmed','Completed']}}),
  ]);
  return Boolean(caseExists || appointmentExists);
}

router.get('/', async (req,res) => {
  try {
    const threads = await MessageThread.find({participants:req.user.id}).populate('participants','name role profilePhoto').sort('-lastMessageAt').limit(50);
    const data = await Promise.all(threads.map(async thread => ({
      ...thread.toObject(),
      unread:await Message.countDocuments({thread:thread._id,recipient:req.user.id,readAt:null}),
    })));
    res.json({success:true,data});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.post('/', async (req,res) => {
  try {
    const recipientId = String(req.body.recipientId || '');
    if (!mongoose.isValidObjectId(recipientId) || recipientId === req.user.id) return res.status(400).json({success:false,message:'Choose a valid contact'});
    if (!await mayMessage(req.user.id,recipientId)) return res.status(403).json({success:false,message:'Messaging is available after a shared case or appointment'});
    let thread = await MessageThread.findOne({participants:{$all:[req.user.id,recipientId],$size:2}});
    if (!thread) thread = await MessageThread.create({participants:[req.user.id,recipientId]});
    res.status(200).json({success:true,data:thread});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.get('/:id', async (req,res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({success:false,message:'Conversation not found'});
    const thread = await MessageThread.findOne({_id:req.params.id,participants:req.user.id});
    if (!thread) return res.status(404).json({success:false,message:'Conversation not found'});
    const messages = await Message.find({thread:thread._id}).populate('sender','name role').sort('createdAt').limit(200);
    await Message.updateMany({thread:thread._id,recipient:req.user.id,readAt:null},{readAt:new Date()});
    res.json({success:true,data:messages});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

router.post('/:id', async (req,res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({success:false,message:'Conversation not found'});
    const body = String(req.body.body || '').trim();
    if (!body || body.length > 4000) return res.status(400).json({success:false,message:'Messages must be between 1 and 4,000 characters'});
    const thread = await MessageThread.findOne({_id:req.params.id,participants:req.user.id});
    if (!thread) return res.status(404).json({success:false,message:'Conversation not found'});
    const recipient = thread.participants.find(participant => participant.toString() !== req.user.id);
    if (!recipient || !await mayMessage(req.user.id,recipient.toString())) return res.status(403).json({success:false,message:'This conversation is no longer available'});
    const message = await Message.create({thread:thread._id,sender:req.user.id,recipient,body});
    thread.lastMessage = body.slice(0,160);
    thread.lastMessageAt = message.createdAt;
    await thread.save();
    await Notification.create({user:recipient,title:'New secure message',message:`${String(req.user.name||'A contact').slice(0,80)}: ${body.slice(0,120)}`,type:'system',link:'/messages'}).catch(console.error);
    res.status(201).json({success:true,data:message});
  } catch(err) { res.status(500).json({success:false,message:err.message}); }
});

module.exports = router;
