import type {RequestBook} from './catalog';
const key=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function mergeRequests(requests:RequestBook[],votes:string[],sourceId:string,targetId:string){
 const source=requests.find(r=>r.id===sourceId),target=requests.find(r=>r.id===targetId);
 if(!source||!target||sourceId===targetId)throw new Error('Choose another existing request.');
 const chars=target.characters.map(c=>({...c}));let nextVotes=[...votes];
 for(const c of source.characters){let match=chars.find(t=>key(t.name)===key(c.name));if(!match){match={...c,sfw:0,adult:0};chars.push(match)}
  for(const kind of ['sfw','adult'] as const){const from=`${sourceId}:${c.name}:${kind}`,to=`${targetId}:${match.name}:${kind}`;const duplicate=nextVotes.includes(from)&&nextVotes.includes(to);match[kind]+=c[kind]-(duplicate?1:0);nextVotes=nextVotes.map(v=>v===from?to:v)}
 }
 return {requests:requests.filter(r=>r.id!==sourceId).map(r=>r.id===targetId?{...r,characters:chars}:r),votes:[...new Set(nextVotes)]};
}
