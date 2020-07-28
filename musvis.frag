precision mediump float;
uniform float t;
uniform vec2 uWindowSize;
uniform sampler2D uSampler;
varying vec2 vTextureCoord;
varying vec3 vFragPos;
varying vec3 vLighting;

void main () {
  vec4 res = vec4(0.0);
  vec4 waveFormData = texture2D(uSampler, vTextureCoord * .5);
  vec4 waveFormDataP = texture2D(uSampler, vTextureCoord * .5 * .1);
  vec4 waveFormDataT = texture2D(uSampler, vTextureCoord.yx * .5);
  vec4 frequencyData = texture2D(uSampler, (.5 + vTextureCoord.yx * .5));
  vec2 fragCoord = vec2(gl_FragCoord.xy / uWindowSize.xy) * 4.0 - 2.0;
  // vec3 lightDir = normalize();


  // camera
  /* vec3 ta = vec3(0.5, -0.4, -0.5);
  // vec3 ro = ta + vec3(4.5 * cos(0.1 * t + 6.0*mo.x), 1.5 + 2.0*mo.y, 4.5*sin(0.1*time + 6.0*mo.x) );
  vec3 ro = ta + vec3(.0);
  // camera-to-world transformation
  mat3 ca = setCamera( ro, ta, 0.0 );
  vec3 tot = vec3(0.0);
  vec2 p = (2.0 * gl_FragCoord.xy - uWindowSize.xy) / uWindowSize.y;
  // ray direction
  vec3 rd = ca * normalize( vec3(p, 2.5) );
  // ray differentials
  vec2 px = (2.0*(gl_FragCoord.xy+vec2(1.0,0.0))-uWindowSize.xy)/uWindowSize.y;
  vec2 py = (2.0*(gl_FragCoord.xy+vec2(0.0,1.0))-uWindowSize.xy)/uWindowSize.y;
  vec3 rdx = ca * normalize( vec3(px,2.5) );
  vec3 rdy = ca * normalize( vec3(py,2.5) );
  // render
  vec3 col = render( ro, rd, rdx, rdy );
  // gain
  // col = col*3.0/(2.5+col);
  // gamma
  col = pow( col, vec3(0.4545) );
  tot += col; */

  vec4 color = vec4(mod(fragCoord.x, .1) * 2.0, mod(fragCoord.y, .1) * 2.0, 0.0, 1.0);
  if (fragCoord.y < -.9) {
    color = vec4(0.0, 1.0, 1.0, 1.0);
  }
  // gl_FragColor = waveFormData;
  // float v = sdCircle(vec2(waveFormData.x, frequencyData.x), .1);
  // float v = sdHexagon(fragCoord.xy, .1);
  // float v = sdBox(vec3(waveFormData.x), vec3(fragCoord.xy, 1.0));
  // float v = sdBox(vec3(fragCoord.x, fragCoord.y,.1), vec3(waveFormData.x, .5, .5));
  // gl_FragColor = vec4(v, v, v, 1.0);
  // gl_FragColor = color;
  color = vec4(0.25, 0.25, 0.25, 1.0);
  gl_FragColor = vec4(color.rgb * vLighting, color.a);
}
