export const modelOptions=Object.freeze({expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]});
export async function inspectModel(api=globalThis.LanguageModel){
 if(!globalThis.isSecureContext)return{state:'unsupported',title:'A secure browser connection is required',detail:'Open this project through its HTTPS hub address.'};
 if(!api||typeof api.availability!=='function'||typeof api.create!=='function')return{state:'unsupported',title:'Built-in local AI is not supported here',detail:'This browser does not expose the LanguageModel API. A compatible desktop Chrome setup may support it; mobile support varies. No model download or online fallback was started.'};
 const value=await api.availability(modelOptions);
 if(value==='available')return{state:value,title:'A local model is already available',detail:'You can start a local session. The model is managed by your browser; this app does not choose or install Qwen/Dolphin.'};
 if(value==='downloadable'||value==='downloading')return{state:value,title:value==='downloading'?'The browser’s model is still downloading':'A model download would be required',detail:'No session will be created in this app while the model is not ready. Demo AI will not initiate a model download. You can check again if a browser-managed model becomes available later.'};
 return{state:'unavailable',title:'A local model is unavailable on this device',detail:'Browser version, device hardware, language support, or browser policy may prevent local AI. This app will not download a model or switch to the cloud.'};
}
export async function createReadySession({api=globalThis.LanguageModel,signal,history=[]}={}){
 const result=await inspectModel(api);if(result.state!=='available')throw Error(result.detail);
 const controller=new AbortController();
 const abort=()=>controller.abort(signal?.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 try {
  const session=await api.create({...modelOptions,signal:controller.signal,initialPrompts:[{role:'system',content:'You are a helpful local AI assistant. Reply in English. Be concise and honest about uncertainty. You cannot browse, access files, or execute code.'},...history],monitor(m){m.addEventListener('downloadprogress',e=>{if(e.loaded<1)controller.abort(new DOMException('A model download was detected; the session was cancelled.','AbortError'));});}});
  if(controller.signal.aborted){session.destroy();throw controller.signal.reason}
  return session;
 } finally {signal?.removeEventListener('abort',abort)}
}
