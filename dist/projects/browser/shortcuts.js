document.addEventListener('keydown',event=>{
 if(event.isComposing)return;
 const target=event.target,typing=['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable;
 if(typing)return;
 const modified=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
 const activate=id=>{const button=document.getElementById(id);if(button&&!button.disabled){event.preventDefault();button.click()}};
 if(modified&&key==='l'){event.preventDefault();const address=document.getElementById('address');address.focus();address.select()}
 else if(modified&&key==='t')activate('new-tab');
 else if(modified&&key==='r')activate('reload');
 else if(modified&&key==='w'){
  const active=document.querySelector('#tabs .tab.active .close');
  if(active){event.preventDefault();active.click()}
 }
 else if(event.altKey&&event.key==='ArrowLeft')activate('back');
 else if(event.altKey&&event.key==='ArrowRight')activate('forward');
},true);
