const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect } = require('../middleware/auth');
router.get('/profile/:id', protect, async (req,res) => {
  try {
    const isSelf=String(req.user.id)===String(req.params.id);
    const fields=isSelf?'name email role phone address profilePhoto bio userId isVerified':'name role profilePhoto bio';
    const user=await User.findById(req.params.id).select(fields);
    if(!user)return res.status(404).json({success:false,message:'User not found'});
    res.json({success:true,data:user});
  } catch(err) { res.status(400).json({success:false,message:'Invalid user identifier'}); }
});
module.exports = router;
