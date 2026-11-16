import { ImageResponse } from 'next/og'
import { studioBrand } from './theme'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
          color: studioBrand.colors.brand,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.05em',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        W
      </div>
    ),
    size
  )
}
