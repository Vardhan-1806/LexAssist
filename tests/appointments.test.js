const test = require('node:test');
const assert = require('node:assert/strict');
const {slotsFor,indiaDayRange,indiaAppointmentDate}=require('../Backend/utils/appointmentSlots');

test('lawyer availability generates only complete one-hour slots',()=>{
  const profile={availability:[{day:'Monday',startTime:'09:00',endTime:'12:00',isAvailable:true}]};
  assert.deepEqual(slotsFor(profile,'2026-11-23',new Date('2026-11-22T12:00:00Z')),['09:00','10:00','11:00']);
  assert.deepEqual(slotsFor(profile,'2026-11-24',new Date('2026-11-22T12:00:00Z')),[]);
});

test('same-day slots in IST exclude times that have already started',()=>{
  const profile={availability:[{day:'Monday',startTime:'09:00',endTime:'12:00',isAvailable:true}]};
  assert.deepEqual(slotsFor(profile,'2026-11-23',new Date('2026-11-23T03:30:00Z')),['10:00','11:00']);
});

test('appointment timestamps and day queries use India Standard Time',()=>{
  assert.equal(indiaAppointmentDate('2026-11-23','09:00').toISOString(),'2026-11-23T03:30:00.000Z');
  const range=indiaDayRange('2026-11-23');
  assert.equal(range.$gte.toISOString(),'2026-11-22T18:30:00.000Z');
  assert.equal(range.$lt.toISOString(),'2026-11-23T18:30:00.000Z');
});
