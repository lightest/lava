precision mediump float;
uniform float t;
uniform vec2 uWindowSize;
uniform sampler2D uSampler;
varying vec2 vTextureCoord;

void main () {
  vec4 waveFormData = texture2D(uSampler, vTextureCoord * .5);
  // vec4 tex = texture2D(uSampler, vTextureCoord);
  vec4 frequencyData = texture2D(uSampler, .5 + vTextureCoord * .5);
  vec2 fragCoord = vec2(gl_FragCoord.xy / uWindowSize.xy);
  vec4 color = vec4(sin(0.0), sin(1.0), 0.0, 1.0);
  color = vec4(sin(fragCoord.xy * 100.0), 0.0, 1.0);
  // if (tex.x != 0.0 || tex.y != 0.0 || tex.z != 0.0) {
  //   color = vec4(1.0, 0.0, 1.0, 1.0);
  // }
  if ((vTextureCoord * .5).x < .25) {
    color = vec4(0.0, 1.0, 1.0, 1.0);
  }
  gl_FragColor = waveFormData * frequencyData;
}
