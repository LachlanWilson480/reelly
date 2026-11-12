// The small "Made with Reelezy" badge that sits in the bottom right corner of every video unless the person removes it in the preview.
// The preview and the render server use the same spot, so what you see is what you get.
export const BADGE_SRC = '/made-with-reelezy.png'
// Width over height of the badge picture
export const BADGE_RATIO = 483 / 96

// x and y are the centre of the badge as a share of the frame, size is its width as a share of the frame
export const BADGE_SPOT = {
  portrait: { x: 0.82, y: 0.948, size: 0.3 },
  landscape: { x: 0.88, y: 0.918, size: 0.18 },
} as const
