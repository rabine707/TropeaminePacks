import './globals.css';
import './collection-locks.css';
export const metadata = {title: 'Tropeamine Packs — A shelf beyond the story', applicationName: 'Tropeamine Packs', description: 'Collect the characters you love. Open packs, complete your binder, and shape the next chapter.'};

const ownershipGuard=`(function(){
  function isOwnedCharacter(name){
    try{
      const raw=localStorage.getItem('tropeamine-packs-v1');
      if(!raw)return false;
      const state=JSON.parse(raw);
      const owned=new Set(Array.isArray(state?.wallet?.owned)?state.wallet.owned.map(String):[]);
      const cards=Array.isArray(state?.cards)?state.cards:[];
      return cards.some(function(card){return String(card?.name||'').trim()===name&&owned.has(String(card?.id));});
    }catch{return false;}
  }
  document.addEventListener('click',function(event){
    const source=event.target;
    if(!(source instanceof Element))return;
    const button=source.closest('.popular-grid button');
    if(!button)return;
    const name=button.querySelector('strong')?.textContent?.trim();
    if(!name||isOwnedCharacter(name))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  },true);
})();`;

export default function Layout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}<style>{`
  .art-button:not(:has(.owned-badge)) .card-art{filter:grayscale(1) brightness(.68) contrast(.92);opacity:1}
  .art-button:not(:has(.owned-badge))::after{opacity:.82}
 `}</style><script dangerouslySetInnerHTML={{__html:ownershipGuard}}/></body></html>
}