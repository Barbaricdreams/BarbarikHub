import { CATEGORIES, LABELS } from './layouts.js';
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const sum = items => round(items.reduce((n,b) => n + b.cost,0));
export function summarize(budget, personId) {
  const household = budget.bills.filter(b => !b.personId);
  const monthly = sum(household), paid = sum(household.filter(b=>b.paid));
  const people = budget.people.map((p,i) => {
    const personal = budget.bills.filter(b=>b.personId===p.id), personalMonthly = sum(personal);
    const contribution = i === 1 ? round(p.contribution) : round(monthly / 2 - budget.people[1].contribution);
    return {...p, contribution, personalMonthly, allocation:round(personalMonthly/2), cash:round(p.halfIncome-contribution-round(personalMonthly/2)), personal, zoneAvailable:budget.sections.some(s=>s.personId===p.id)};
  });
  return { monthly, paid, remaining:round(monthly-paid), household, people, person:people.find(p=>p.id===personId), categories:CATEGORIES.map(id=>({id,label:LABELS[id],total:sum(household.filter(b=>b.category===id))})), halfIncome:round(people.reduce((n,p)=>n+p.halfIncome,0)) };
}
export function dueDate(period, day) {
  if (!period || !day) return null;
  return new Date(period.year,period.month,Math.min(day,new Date(period.year,period.month+1,0).getDate()));
}
export function upcoming(budget,personId,now=new Date()) {
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  return budget.bills.filter(b=>!b.paid && (!b.personId || b.personId===personId) && b.dueDay).map(b=>({...b,date:dueDate(budget.period,b.dueDay)})).filter(b=>b.date).sort((a,b)=>a.date-b.date).slice(0,6).map(b=>({...b,overdue:b.date<today}));
}
