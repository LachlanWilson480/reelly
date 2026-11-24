// The small "Made with Reelezy" badge that sits in the bottom right corner of every video unless the person removes it in the preview.
// The preview and the render server use the same spot, so what you see is what you get.
export const BADGE_SRC = '/made-with-reelezy.png'
// Width over height of the badge picture
export const BADGE_RATIO = 483 / 96

// x and y are the centre of the badge as a share of the frame, size is its width as a share of the frame
export const BADGE_SPOT = {
  portrait: { x: 0.77, y: 0.94, size: 0.4 },
  landscape: { x: 0.85, y: 0.91, size: 0.24 },
} as const
