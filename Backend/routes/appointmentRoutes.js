const express = require('express');
const router  = express.Router();
const { getAppointments, bookAppointment, updateStatus, getAvailableSlots, rescheduleAppointment, setMeetingLink } = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');

router.get('/',                    protect, getAppointments);
router.post('/',                   protect, bookAppointment);
router.get('/slots',               protect, getAvailableSlots);
router.put('/:id/reschedule',      protect, rescheduleAppointment);
router.put('/:id/meeting-link',    protect, setMeetingLink);
router.put('/:id/status',          protect, updateStatus);

module.exports = router;
