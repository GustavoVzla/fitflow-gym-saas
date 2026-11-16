import { ImageResponse } from 'next/og'
import { studioBrand } from '../theme'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: studioBrand.colors.bgDeep,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: studioBrand.colors.brandLight,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 700,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          W
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.2em',
            color: 'rgba(240,240,245,0.45)',
            display: 'flex',
          }}
        >
          STUDIO
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
