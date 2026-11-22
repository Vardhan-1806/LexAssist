const Appointment = require('../models/Appointment');
const { Notification, CalendarEvent } = require('../models/Extras');
const Lawyer  = require('../models/Lawyer');
const User    = require('../models/User');
const {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate
} = require('../utils/emailService');
const {localDateKey,indiaDayRange,indiaAppointmentDate,slotsFor}=require('../utils/appointmentSlots');

// @route GET /api/appointments
exports.getAppointments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'citizen') filter.citizen = req.user.id;
    if (req.user.role === 'lawyer')  filter.lawyer  = req.user.id;

    const appointments = await Appointment.find(filter)
      .populate('citizen', 'name email phone')
      .populate('lawyer',  'name email phone')
      .populate('case',    'caseNumber title')
      .sort('-date');

    res.json({ success:true, count:appointments.length, data:appointments });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route POST /api/appointments — Book appointment
exports.bookAppointment = async (req, res) => {
  try {
    if (req.user.role !== 'citizen') return res.status(403).json({success:false,message:'Only citizens can request appointments'});
    const { lawyerId, date, timeSlot, type, mode, notes, caseId } = req.body;
    const lawyerProfile = await Lawyer.findOne({ user:lawyerId, isVerified:true });
    if (!lawyerProfile) return res.status(404).json({success:false,message:'Verified lawyer not found'});
    if (!date || Number.isNaN(new Date(date).getTime()) || localDateKey(date)<localDateKey(new Date()) || !timeSlot?.start || !timeSlot?.end) return res.status(400).json({success:false,message:'Choose a valid future date and time'});
    const [slotHour,slotMinute]=String(timeSlot.start).split(':').map(Number);
    const slotEnd=Number.isInteger(slotHour)&&Number.isInteger(slotMinute)?slotHour*60+slotMinute+60:-1;
    const expectedEnd=slotEnd>=0?`${String(Math.floor(slotEnd/60)).padStart(2,'0')}:${String(slotEnd%60).padStart(2,'0')}`:'';
    if (!slotsFor(lawyerProfile,date).includes(timeSlot.start) || timeSlot.end !== expectedEnd) return res.status(400).json({success:false,message:'Choose an available one-hour time slot'});
    if (type && !['Consultation','Court Argument','Court Preparation'].includes(type)) return res.status(400).json({success:false,message:'Choose a valid appointment purpose'});
    if (mode && !['In-Person','Online','Phone'].includes(mode)) return res.status(400).json({success:false,message:'Choose a valid consultation format'});
    if (!slotsFor(lawyerProfile,date).includes(timeSlot.start)) return res.status(400).json({success:false,message:'That time is outside the lawyer’s published availability'});
    if (caseId) {
      const Case = require('../models/Case');
      if (!await Case.findOne({_id:caseId,citizen:req.user.id})) return res.status(403).json({success:false,message:'That case is not available to your account'});
    }

    // Check slot availability
    const conflict = await Appointment.findOne({
      lawyer: lawyerId,
      date:   indiaDayRange(date),
      'timeSlot.start': timeSlot.start,
      status: { $nin: ['Cancelled'] },
    });
    if (conflict) return res.status(400).json({ success:false, message:'This time slot is not available. Please choose another.' });

    const lawyer     = await Lawyer.findOne({ user: lawyerId });
    const lawyerUser = await User.findById(lawyerId).select('name email');
    const citizen    = await User.findById(req.user.id).select('name email');

    const scheduledAt=indiaAppointmentDate(date,timeSlot.start);
    const appointment = await Appointment.create({
      citizen: req.user.id,
      lawyer:  lawyerId,
      case:    caseId || undefined,
      date:scheduledAt, timeSlot, type, mode, notes,
      fee: lawyer?.consultationFee || 0,
    });

    // Calendar event for citizen
    await CalendarEvent.create({
      user:      req.user.id,
      title:     `Appointment with ${lawyerUser?.name||'Lawyer'} – ${type}`,
      startDate: scheduledAt,
      type:      'Appointment',
      case:      caseId || undefined,
      appointment:appointment._id,
      color:     '#4f46e5',
    });
    await CalendarEvent.create({
      user:lawyerId,title:`Consultation with ${citizen?.name||'Citizen'} – ${type}`,startDate:scheduledAt,
      type:'Appointment',case:caseId||undefined,appointment:appointment._id,color:'#c5a66a',
    });

    // In-app notification for lawyer
    await Notification.create({
      user:    lawyerId,
      title:   '📅 New Appointment Request',
      message: `${citizen?.name} booked a ${type} on ${new Date(date).toLocaleDateString('en-IN')}`,
      type:    'appointment',
      link:    '/appointments',
    });

    // Send confirmation emails to both
    if (citizen && lawyerUser) {
      sendAppointmentConfirmation(citizen, lawyerUser, appointment).catch(console.error);
    }

    res.status(201).json({ success:true, data:appointment });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/appointments/:id/status — Update status
exports.updateStatus = async (req, res) => {
  try {
    const { status, cancelReason, meetingLink } = req.body;
    const appt = await Appointment.findById(req.params.id)
      .populate('citizen', 'name email')
      .populate('lawyer',  'name email');

    if (!appt) return res.status(404).json({ success:false, message:'Appointment not found' });

    const callerId = req.user.id;
    const isLawyer = req.user.role === 'lawyer' && appt.lawyer._id.toString() === callerId;
    const isCitizen = req.user.role === 'citizen' && appt.citizen._id.toString() === callerId;
    if (!isLawyer && !isCitizen) return res.status(403).json({success:false,message:'You cannot change this appointment'});
    const transitions = isLawyer
      ? ({ Pending:['Confirmed','Cancelled'], Confirmed:['Cancelled','Completed','No-Show'] }[appt.status] || [])
      : (['Pending','Confirmed'].includes(appt.status) ? ['Cancelled'] : []);
    if (!transitions.includes(status)) return res.status(400).json({success:false,message:'That appointment status change is not allowed'});
    if (meetingLink && !isLawyer) return res.status(403).json({success:false,message:'Only the assigned lawyer can add a meeting link'});
    if (meetingLink) {
      try { if (new URL(meetingLink).protocol !== 'https:') throw new Error(); }
      catch (_) { return res.status(400).json({success:false,message:'Meeting links must use a secure HTTPS address'}); }
    }

    appt.status = status;
    if (status==='Cancelled' && isLawyer && !String(cancelReason||'').trim()) return res.status(400).json({success:false,message:'Add a brief reason when declining an appointment'});
    if (cancelReason) appt.cancelReason = String(cancelReason).trim().slice(0,500);
    if (meetingLink)  appt.meetingLink  = meetingLink;
    await appt.save();

    if(status==='Cancelled') await CalendarEvent.deleteMany({appointment:appt._id});

    // Notify the other party
    const notifyUser = req.user.role==='lawyer' ? appt.citizen._id : appt.lawyer._id;
    const notifyEmail= req.user.role==='lawyer' ? appt.citizen.email : appt.lawyer.email;

    await Notification.create({
      user:    notifyUser,
      title:   `📅 Appointment ${status}`,
      message: `Your appointment on ${new Date(appt.date).toLocaleDateString('en-IN')} has been ${status.toLowerCase()}.`,
      type:    'appointment',
      link:    '/appointments',
    });

    // Send email to the other party
    const targetUser = req.user.role==='lawyer' ? appt.citizen : appt.lawyer;
    if (targetUser?.email) {
      sendAppointmentStatusUpdate(targetUser, appt, status).catch(console.error);
    }

    res.json({ success:true, data:appt });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/appointments/slots — Available time slots
exports.getAvailableSlots = async (req, res) => {
  try {
    const { lawyerId, date } = req.query;
    const profile=await Lawyer.findOne({user:lawyerId,isVerified:true});
    if(!profile)return res.status(404).json({success:false,message:'Verified lawyer not found'});
    if(!date || Number.isNaN(new Date(date).getTime()))return res.status(400).json({success:false,message:'Choose a valid date'});
    const scheduleSlots=slotsFor(profile,date);
    const booked = await Appointment.find({
      lawyer: lawyerId,
      date:   indiaDayRange(date),
      status: { $nin: ['Cancelled'] },
    }).select('timeSlot');

    const excludeId=String(req.query.excludeId||'');
    const canExclude=excludeId && req.user.role==='lawyer' && await Appointment.exists({_id:excludeId,lawyer:req.user.id,status:'Confirmed'});
    const bookedSlots = booked.filter(a=>!canExclude || a._id.toString()!==excludeId).map(a => a.timeSlot.start);
    const available   = scheduleSlots.filter(s => !bookedSlots.includes(s));

    res.json({ success:true, data:available });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.rescheduleAppointment=async(req,res)=>{
  try{
    const appointment=await Appointment.findById(req.params.id);
    if(!appointment)return res.status(404).json({success:false,message:'Appointment not found'});
    if(req.user.role!=='lawyer'||appointment.lawyer.toString()!==req.user.id)return res.status(403).json({success:false,message:'Only the assigned lawyer can reschedule this appointment'});
    if(appointment.status!=='Confirmed')return res.status(400).json({success:false,message:'Only confirmed appointments can be rescheduled'});
    const {date,timeSlot}=req.body;
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date).getTime())||localDateKey(date)<localDateKey(new Date())||!timeSlot?.start||!timeSlot?.end)
      return res.status(400).json({success:false,message:'Choose a valid future date and time'});
    const profile=await Lawyer.findOne({user:appointment.lawyer,isVerified:true});
    const hour=Number(String(timeSlot.start).slice(0,2)),minute=Number(String(timeSlot.start).slice(3));
    const expectedEnd=`${String(Math.floor((hour*60+minute+60)/60)).padStart(2,'0')}:${String((hour*60+minute+60)%60).padStart(2,'0')}`;
    if(!profile||!slotsFor(profile,date).includes(timeSlot.start)||timeSlot.end!==expectedEnd)return res.status(400).json({success:false,message:'Choose an available one-hour slot from your published hours'});
    const conflict=await Appointment.exists({_id:{$ne:appointment._id},lawyer:appointment.lawyer,date:indiaDayRange(date),'timeSlot.start':timeSlot.start,status:{$nin:['Cancelled']}});
    if(conflict)return res.status(409).json({success:false,message:'That slot was just booked. Choose another time'});
    appointment.date=indiaAppointmentDate(date,timeSlot.start);appointment.timeSlot={start:timeSlot.start,end:timeSlot.end};await appointment.save();
    await CalendarEvent.updateMany({appointment:appointment._id},{startDate:appointment.date});
    const message=`Your lawyer rescheduled the consultation to ${new Date(appointment.date).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})} IST.`;
    await Notification.create({user:appointment.citizen,title:'Appointment rescheduled',message,type:'appointment',link:'/appointments'});
    res.json({success:true,data:appointment});
  }catch(err){res.status(500).json({success:false,message:err.message});}
};

exports.setMeetingLink=async(req,res)=>{
  try{
    const appointment=await Appointment.findById(req.params.id);
    if(!appointment)return res.status(404).json({success:false,message:'Appointment not found'});
    if(req.user.role!=='lawyer'||appointment.lawyer.toString()!==req.user.id)return res.status(403).json({success:false,message:'Only the assigned lawyer can add a meeting link'});
    if(appointment.status!=='Confirmed'||appointment.mode!=='Online')return res.status(400).json({success:false,message:'Meeting links are available for confirmed online appointments'});
    let meetingLink;
    try{const parsed=new URL(String(req.body.meetingLink||''));if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error();meetingLink=parsed.href;}
    catch(_){return res.status(400).json({success:false,message:'Enter a valid secure HTTPS meeting link'});}
    appointment.meetingLink=meetingLink;await appointment.save();
    await Notification.create({user:appointment.citizen,title:'Meeting link added',message:'Your lawyer added a secure link for your online consultation.',type:'appointment',link:'/appointments'});
    res.json({success:true,data:appointment});
  }catch(err){res.status(500).json({success:false,message:err.message});}
};
