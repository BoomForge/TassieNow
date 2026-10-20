/**
 * Keep the Tasmanian event-calendar day, rather than the UTC date of an instant.
 * Date-only and floating local datetimes are calendar labels. Offset-bearing
 * and Z datetimes are instants and must be converted into Australia/Hobart.
 */
const format=new Intl.DateTimeFormat('en-CA',{
 timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'
});
const isValidDate=(yyyy,mm,dd)=>{
 const d=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd)));
 return d.getUTCFullYear()===Number(yyyy)&&d.getUTCMonth()+1===Number(mm)&&d.getUTCDate()===Number(dd);
};
export function tasEventCalendarDate(value){
 if(typeof value!=='string')return null;
 const s=value.trim();
 const m=/^(20\d{2})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
 if(!m||!isValidDate(m[1],m[2],m[3]))return null;
 if(m[4]!==undefined&&(Number(m[4])>23||Number(m[5])>59||Number(m[6]||0)>59))return null;
 const original=m[1]+'-'+m[2]+'-'+m[3];
 if(!m[7])return original; // Source supplied a floating local date/time.
 const normalized=s.replace(' ','T');
 const date=new Date(normalized);
 return Number.isNaN(date.valueOf())?null:format.format(date);
}
