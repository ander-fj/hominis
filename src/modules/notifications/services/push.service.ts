export interface PushPermissionState { supported:boolean; permission:NotificationPermission; }
export const pushService={
  state():PushPermissionState{return {supported:typeof window!=='undefined'&&'Notification'in window&&'serviceWorker'in navigator,permission:typeof Notification==='undefined'?'default':Notification.permission};},
  async enable(){const s=this.state(); if(!s.supported) throw new Error('Notificações push não são suportadas neste dispositivo.'); const permission=await Notification.requestPermission(); if(permission!=='granted') throw new Error('Permissão para notificações não concedida.'); return permission;},
  async notify(title:string,body:string){const s=this.state(); if(!s.supported||s.permission!=='granted') return false; const registration=await navigator.serviceWorker.ready; if(registration.showNotification){await registration.showNotification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png'}); return true;} return false;}
};
