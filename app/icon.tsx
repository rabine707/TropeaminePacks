import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#c58f98',color:'#171516',fontFamily:'Georgia',fontSize:260,fontWeight:700,letterSpacing:-32}}>
      <span style={{display:'flex',alignItems:'center'}}>T<span style={{fontSize:205,marginLeft:-24}}>P</span></span>
    </div>,
    size
  );
}
