precision mediump float;
uniform float t;
uniform vec2 uWindowSize;
uniform sampler2D uSampler;
varying vec2 vTextureCoord;
// uniform float uWaveForm1[1024];

void main () {
  vec4 tex = texture2D(uSampler, vTextureCoord);
  vec2 fragCoord = vec2(gl_FragCoord.xy / uWindowSize.xy);
  int idx = int(fragCoord.x * 1023.0);
  vec4 color = vec4(sin(0.0), sin(1.0), 0.0, 1.0);
  color = vec4(sin(fragCoord.xy * 100.0), 0.0, 1.0);
  if (tex.x != 0.0 || tex.y != 0.0 || tex.z != 0.0) {
    color = vec4(1.0, 0.0, 1.0, 1.0);
  }
  // if (vTextureCoord.y < .5) {

  //   color = vec4(0.0, 1.0, 1.0, 1.0);
  // }
  gl_FragColor = tex;
}
