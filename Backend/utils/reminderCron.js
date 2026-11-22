/**
 * LEXASSIST — Reminder Cron Jobs
 * Runs daily at 8 AM to send hearing reminders
 */

const cron = require('node-cron');
const Case  = require('../models/Case');
const User  = require('../models/User');
const { Notification } = require('../models/Extras');
const { sendHearingReminder } = require('./emailService');
const { indiaDayRange } = require('./appointmentSlots');

const startReminders = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running hearing reminder job...');
    try {
      const now=new Date();
      const indiaToday=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)+'T00:00:00+05:30');
      const tomorrow=new Date(indiaToday.getTime()+24*60*60*1000);

      // Cases with hearing tomorrow
      const tomorrowCases = await Case.find({
        nextHearingDate: indiaDayRange(tomorrow),
        status: { $in: ['Active','Pending'] }
      }).populate('citizen', 'name email').populate('lawyer', 'name email');

      // Cases with hearing today
      const todayCases = await Case.find({
        nextHearingDate: indiaDayRange(indiaToday),
        status: { $in: ['Active','Pending'] }
      }).populate('citizen', 'name email').populate('lawyer', 'name email');

      const sendReminders = async (cases, daysLeft) => {
        for (const c of cases) {
          // Notify citizen
          if (c.citizen?.email) {
            await sendHearingReminder(c.citizen.email,c.citizen.name,c.caseNumber,c.title,c.court,daysLeft).catch(console.error);
            await Notification.create({
              user:    c.citizen._id,
              title:   `⏰ ${daysLeft===0?'Today':'Tomorrow'}: Hearing for ${c.caseNumber}`,
              message: `Your hearing for "${c.title}" is ${daysLeft===0?'today':'tomorrow'}. ${c.court ? `Court: ${c.court}` : ''}`,
              type:    'hearing',
              link:    '/cases',
            }).catch(console.error);
          }
          // Notify lawyer
          if (c.lawyer?.email) {
            await sendHearingReminder(c.lawyer.email,c.lawyer.name,c.caseNumber,c.title,c.court,daysLeft).catch(console.error);
            await Notification.create({
              user:    c.lawyer._id,
              title:   `⏰ ${daysLeft===0?'Today':'Tomorrow'}: Hearing for ${c.caseNumber}`,
              message: `Hearing for client case "${c.title}" is ${daysLeft===0?'today':'tomorrow'}.`,
              type:    'hearing',
              link:    '/cases',
            }).catch(console.error);
          }
        }
        console.log(`✅ Sent ${cases.length} ${daysLeft===0?'today':'tomorrow'} reminders`);
      };

      await sendReminders(tomorrowCases, 1);
      await sendReminders(todayCases, 0);

    } catch(err) {
      console.error('Reminder cron error:', err.message);
    }
  },{timezone:'Asia/Kolkata'});

  console.log('✅ Reminder cron job scheduled (daily 8 AM)');
};

module.exports = { startReminders };
