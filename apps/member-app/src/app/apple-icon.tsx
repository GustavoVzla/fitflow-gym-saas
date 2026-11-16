import { ImageResponse } from 'next/og'
import { studioBrand } from './theme'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          color: studioBrand.colors.brand,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 30% 30%, rgba(59,139,234,0.18), transparent 60%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            fontSize: 100,
            fontWeight: 700,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            color: studioBrand.colors.brandLight,
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
    size
  )
}
