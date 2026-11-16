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
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 30% 30%, rgba(59,139,234,0.15), transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            fontSize: 290,
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
            marginTop: 8,
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: '0.25em',
            color: 'rgba(240,240,245,0.5)',
            display: 'flex',
          }}
        >
          STUDIO
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
