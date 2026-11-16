import { ImageResponse } from 'next/og'
import { studioBrand } from '../theme'

export const runtime = 'edge'

// Maskable icon: safe zone is central 80% (40% radius from center).
// Full bleed background, content concentrated en el centro.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: studioBrand.colors.bgDeep,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: studioBrand.colors.brandLight,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 700,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          W
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
