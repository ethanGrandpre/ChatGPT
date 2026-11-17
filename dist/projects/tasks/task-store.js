import {MAX_TASKS,normalizeTask,parseTasks} from './tasks-model.js';
const fingerprint=task=>task?JSON.stringify(normalizeTask(task)):null;
export class TaskConflict extends Error{constructor(latest,ids){super('A task changed in another tab. Review the latest version before saving.');this.name='TaskConflict';this.latest=latest;this.ids=ids}}
export function mergeTaskChanges(base,next,latest){
 const before=new Map(base.map(t=>[t.id,t])),after=new Map(next.map(t=>[t.id,t])),current=new Map(latest.map(t=>[t.id,t]));
 const changed=[...new Set([...before.keys(),...after.keys()])].filter(id=>fingerprint(before.get(id))!==fingerprint(after.get(id)));
 const conflicts=changed.filter(id=>fingerprint(current.get(id))!==fingerprint(before.get(id))&&fingerprint(current.get(id))!==fingerprint(after.get(id)));
 if(conflicts.length)throw new TaskConflict(latest,conflicts);
 for(const id of changed){if(after.has(id))current.set(id,after.get(id));else current.delete(id)}
 if(current.size>MAX_TASKS)throw Error('This change would exceed the 500-task limit.');
 return parseTasks([...current.values()],{strict:true});
}
export function sameTask(a,b){return fingerprint(a)===fingerprint(b)}
