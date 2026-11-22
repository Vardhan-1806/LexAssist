const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { CalendarEvent } = require('../models/Extras');
router.get('/',    protect, async (req,res) => { const e = await CalendarEvent.find({user:req.user.id}).sort('startDate'); res.json({success:true,data:e}); });
router.post('/', protect, async (req,res) => {
  try {
    const { title, description, startDate, endDate, type, case:caseId, color, isAllDay } = req.body;
    if (caseId) {
      const Case = require('../models/Case');
      const c = await Case.findOne({ _id:caseId, $or:[{citizen:req.user.id},{lawyer:req.user.id}] });
      if (!c && req.user.role !== 'admin') return res.status(403).json({success:false,message:'That case is not available to your account'});
    }
    const e = await CalendarEvent.create({ user:req.user.id, title, description, startDate, endDate, type, case:caseId, color, isAllDay });
    res.status(201).json({success:true,data:e});
  } catch (err) { res.status(400).json({success:false,message:err.message}); }
});
router.put('/:id', protect, async (req,res) => {
  try {
    const e = await CalendarEvent.findOne({ _id:req.params.id, user:req.user.id });
    if (!e) return res.status(404).json({success:false,message:'Calendar event not found'});
    ['title','description','startDate','endDate','type','color','isAllDay'].forEach(key => { if (req.body[key] !== undefined) e[key] = req.body[key]; });
    await e.save();
    res.json({success:true,data:e});
  } catch (err) { res.status(400).json({success:false,message:err.message}); }
});
router.delete('/:id', protect, async (req,res) => {
  const e = await CalendarEvent.findOneAndDelete({ _id:req.params.id, user:req.user.id });
  if (!e) return res.status(404).json({success:false,message:'Calendar event not found'});
  res.json({success:true});
});
module.exports = router;
