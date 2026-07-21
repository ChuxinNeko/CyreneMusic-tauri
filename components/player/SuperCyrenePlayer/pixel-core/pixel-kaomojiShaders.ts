export const KAOMOJI_VERTEX_SHADER = `
attribute float aKaomojiIndex;
attribute float aPhase;

uniform float uTime;
uniform float uSize;
uniform float uOpacity;
uniform float uCols;
uniform float uRows;
uniform float uPulse;

varying vec2 vUv;
varying float vOpacity;
varying float vIndex;

void main() {
  vec3 worldPos = position;
  worldPos.x += sin(uTime * 0.17 + aPhase) * 0.08;
  worldPos.y += sin(uTime * 0.11 + aPhase * 1.3) * 0.06;
  worldPos.z += cos(uTime * 0.13 + aPhase * 0.7) * 0.08;

  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);

  float size = uSize * (1.0 + 0.3 * sin(uTime * 1.9 + aPhase)) * uPulse;
  float projected = size * 300.0 / max(-mvPosition.z, 0.1);
  gl_PointSize = clamp(projected, 4.0, 64.0);

  vOpacity = uOpacity;
  vIndex = aKaomojiIndex;
  gl_Position = projectionMatrix * mvPosition;
}
`

export const KAOMOJI_FRAGMENT_SHADER = `
uniform sampler2D uAtlas;
uniform float uCols;
uniform float uRows;

varying float vOpacity;
varying float vIndex;

void main() {
  vec2 point = gl_PointCoord - vec2(0.5);
  float radius = length(point);
  if (radius > 0.5) discard;

  float col = mod(vIndex, uCols);
  float row = floor(vIndex / uCols);
  vec2 cellSize = vec2(1.0 / uCols, 1.0 / uRows);
  vec2 flippedCoord = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
  vec2 cellOffset = vec2(col * cellSize.x, row * cellSize.y);

  vec2 atlasUv = cellOffset + flippedCoord * cellSize;
  vec4 texel = texture2D(uAtlas, atlasUv);

  float alpha = texel.a * vOpacity;
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(texel.rgb, alpha);
}
`