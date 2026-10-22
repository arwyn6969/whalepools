/** A wallet prompt must never pull a visitor away from a live page or new route. */
export function signInLanding(entry,current){
 if(entry!==current)return null;
 const url=new URL(current);
 if(/^#(?:paper|tide|live-pilot)(?:\/|$)/.test(url.hash)||/\/watch\/[^/]+\/?$/.test(url.pathname))return null;
 return 'seat';
}
