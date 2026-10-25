// Caption layers: layer 1 is the on-screen text from the filming instructions, layer 2 is what the person says.
// x and y are where the middle of the text sits, as a share of the video (0 to 1). Left empty, they follow the Position setting.
export type CaptionPosition = 'top' | 'center' | 'bottom'
export type LayerKey = 'onScreen' | 'speech'
export type LayerSetting = { on: boolean; x?: number; y?: number }
export type CaptionLayers = { onScreen: LayerSetting; speech: LayerSetting }

export const DEFAULT_CAPTION_LAYERS: CaptionLayers = { onScreen: { on: true }, speech: { on: true } }

export function autoLayerY(layer: LayerKey, position: CaptionPosition): number {
  if (position === 'top') return layer === 'onScreen' ? 0.1 : 0.24
  if (position === 'center') return layer === 'onScreen' ? 0.38 : 0.52
  return layer === 'onScreen' ? 0.66 : 0.8
}

export function layerPoint(layers: CaptionLayers, layer: LayerKey, position: CaptionPosition) {
  const l = layers[layer]
  return { x: l.x ?? 0.5, y: l.y ?? autoLayerY(layer, position) }
}

// What gets sent to the render server. In "write my own" mode the typed captions are shown on layer 2.
export function resolveCaptionLayers(layers: CaptionLayers, position: CaptionPosition, ownMode: boolean) {
  const one = (k: LayerKey) => ({ enabled: layers[k].on, ...layerPoint(layers, k, position) })
  return { onScreen: one('onScreen'), speech: one('speech'), textLayer: ownMode ? 'speech' : 'onScreen' }
}
