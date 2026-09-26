import { ImageResponse } from 'next/og';

export const alt = 'Tropeamine Packs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f5f0e8',color:'#171516'}}>
      <div style={{display:'flex',alignItems:'center',fontFamily:'Georgia',fontSize:112,fontWeight:700,letterSpacing:-5}}>
        TROPEAM<span style={{display:'flex',alignItems:'center',justifyContent:'center',width:84,height:112,position:'relative'}}>
          <span style={{position:'absolute',fontSize:112}}>O</span><span style={{color:'#c47f8c',fontSize:54,zIndex:2}}>◆</span>
        </span>INE
      </div>
      <div style={{display:'flex',alignItems:'center',gap:28,marginTop:16}}>
        <span style={{width:150,height:3,background:'#c47f8c'}} />
        <span style={{fontFamily:'Arial',fontSize:44,letterSpacing:22}}>PACKS</span>
        <span style={{width:150,height:3,background:'#c47f8c'}} />
      </div>
      <div style={{fontFamily:'Arial',fontSize:25,letterSpacing:2,color:'#6b6264',marginTop:38}}>A SHELF BEYOND THE STORY</div>
    </div>,
    size
  );
}
