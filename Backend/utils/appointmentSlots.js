const ALL_SLOTS=['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

const localWeekday=date=>new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Asia/Kolkata'}).format(new Date(date));
const localDateKey=date=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Kolkata'}).format(new Date(date));
const indiaDayRange=date=>{const start=new Date(`${localDateKey(date)}T00:00:00+05:30`);return{$gte:start,$lt:new Date(start.getTime()+24*60*60*1000)};};
const indiaAppointmentDate=(date,slot)=>new Date(`${localDateKey(date)}T${slot}:00+05:30`);

const slotsFor=(profile,date,now=new Date())=>{
  let slots;
  if(!profile.availability?.length)slots=[...ALL_SLOTS];
  else{
    const schedule=profile.availability.find(item=>item.day===localWeekday(date)&&item.isAvailable!==false);
    if(!schedule)return[];
    const [sh,sm]=String(schedule.startTime||'09:00').split(':').map(Number);
    const [eh,em]=String(schedule.endTime||'17:00').split(':').map(Number);
    const start=sh*60+sm,end=eh*60+em;slots=[];
    for(let minute=start;minute+60<=end;minute+=60)slots.push(`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`);
  }
  if(localDateKey(date)===localDateKey(now)){
    const current=new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Kolkata'}).format(now).split(':').map(Number);
    const currentMinutes=current[0]*60+current[1];
    return slots.filter(slot=>{const[hour,minute]=slot.split(':').map(Number);return hour*60+minute>currentMinutes;});
  }
  return slots;
};

module.exports={ALL_SLOTS,localWeekday,localDateKey,indiaDayRange,indiaAppointmentDate,slotsFor};
