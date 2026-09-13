/** Fictional records only. Never copy household values into committed test data. */
export function fixture({legacy=false,title='September 26',id=101}={}) {
  const s={id,title,values:Array.from({length:40},()=>Array(32).fill('')),formulas:{},merges:[],checkboxes:[]};
  const put=(r,c,v)=>s.values[r-1][c-1]=v;
  const grid=(r,c,name,rows,balance=false)=>{
    put(r,c,name);['Bill','Monthly cost',...(balance?['Balance']:[]),'Paid','Date'].forEach((v,i)=>put(r+1,c+i,v));
    for(let i=r+2;i<r+2+rows;i++)put(i,c+(balance?3:2),false);
    put(r+2+rows,c,'Total');return r+2;
  };
  grid(5,2,'Utilities',13);grid(5,7,'Entertainment',legacy?13:15);grid(5,12,'Debt',legacy?5:6,true);grid(legacy?5:15,legacy?18:12,'Transportation',5,!legacy);
  put(7,2,'Home');put(7,3,1200);put(7,4,true);put(7,5,'1st');put(9,2,'Electric');put(9,3,110);put(9,5,'31st');
  put(7,7,'Music');put(7,8,30);put(7,10,'8th');put(7,12,'Loan');put(7,13,140);put(7,14,2500);put(7,16,'12th');
  put(legacy?7:17,legacy?18:12,'Transit');put(legacy?7:17,legacy?19:13,75);put(legacy?7:17,legacy?21:16,'20th');
  const zone=(nameCol,costCol,balanceCol,paidCol,dateCol,title)=>{
    put(2,nameCol,title);put(5,nameCol,'Monthly bills');put(5,costCol,70);put(5,dateCol,35);
    for(const [c,v] of [[nameCol,'Name'],[costCol,'Cost'],[balanceCol,'Debt'],[paidCol,'Paid'],[dateCol,'Date']])put(6,c,v);
    for(let r=7;r<=27;r++){put(r,paidCol,false);s.merges.push({startRow:r,endRow:r,startCol:nameCol,endCol:nameCol+1});}
    put(7,nameCol,'Personal subscription');put(7,costCol,50);put(7,dateCol,'18th');put(9,nameCol,'Hobby');put(9,costCol,20);put(9,dateCol,'21st');put(19,nameCol,'Late row');put(19,costCol,15);
  };
  if(legacy)zone(23,25,26,27,28,"Alex's Zone");else{zone(19,21,22,23,24,'Personal Zone - User 1');zone(26,28,29,30,31,'Personal Zone - User 2');put(7,28,12);put(9,28,8);put(19,28,0);}
  const c=legacy?12:7,r=legacy?22:25,h=legacy?26:29,k=legacy?14:9;
  put(r,c,'Income - Monthly');put(r,k,'Bill Deposit - Biweekly');put(r+1,c,'Alex');put(r+2,c,'Jamie');put(r+1,c+1,3400);put(r+2,c+1,2000);put(r+1,k,477.5);put(r+2,k,300);put(r+3,c,'Total');
  put(h,c,'Income - Biweekly');put(h,k,'Personal Cash - Biweekly');put(h+1,c,1700);put(h+2,c,1000);put(h+3,c,'Total');
  return s;
}
