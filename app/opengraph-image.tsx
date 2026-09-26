import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Tropeamine Packs — A shelf beyond the story';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0d100d',
          color: '#f2efe5',
          padding: '72px 82px',
          fontFamily: 'Georgia',
          border: '12px solid #c8b57b',
        }}
      >
        <div style={{display:'flex',alignItems:'center',gap:28}}>
          <div style={{
            width: 116,
            height: 116,
            borderRadius: 28,
            background: '#c58f98',
            color: '#171516',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 58,
            fontWeight: 700,
          }}>TP</div>
          <div style={{display:'flex',flexDirection:'column'}}>
            <div style={{fontSize:28,letterSpacing:7,color:'#c8b57b'}}>TROPEAMINE PACKS</div>
            <div style={{fontSize:18,letterSpacing:4,color:'#919889',marginTop:10}}>COLLECT · DISCOVER · COMPLETE</div>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',maxWidth:950}}>
          <div style={{fontSize:78,lineHeight:1.05}}>A shelf beyond the story.</div>
          <div style={{fontSize:31,lineHeight:1.35,color:'#b8b9ae',marginTop:26}}>
            Collect the characters you love. Open packs, complete your binder, and shape the next chapter.
          </div>
        </div>
        <div style={{fontSize:22,letterSpacing:3,color:'#c8b57b'}}>TROPEAMINEPACKS.VERCEL.APP</div>
      </div>
    ),
    size
  );
}
