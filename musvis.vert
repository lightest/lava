precision mediump float;
attribute vec4 aVPos;
attribute vec2 aTextureCoord;
attribute float aTimeDomainMul;
attribute vec3 aAdjacentV0;
attribute vec3 aAdjacentV1;
attribute vec3 aNormal;
uniform mat4 uMVMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uLightPos;
uniform vec3 uAmbientLightColor;
uniform vec3 uSpecLightColor;
uniform vec3 uDirLightColor;
varying vec2 vTextureCoord;
varying vec3 vFragPos;
varying vec3 vLighting;

void main () {
  // vec4 verPos = vec4(aVPos.x * aTimeDomainMul, aVPos.y * aTimeDomainMul, aVPos.z * aTimeDomainMul, aVPos.w);
  float mul = aTimeDomainMul * 2.0;
  // vec4 verPos = vec4(aVPos.x, aVPos.y, mul * 2.0, aVPos.w);
  vec4 verPos = aVPos;
  vec3 edge0 = aAdjacentV0 - verPos.xyz;
  vec3 edge1 = aAdjacentV1 - verPos.xyz;
  vec3 faceNormal = cross(edge1, edge0);
  faceNormal = aNormal;
  // faceNormal = vec3(0.0, 0.0, 1.0);
  // gl_Position = uProjectionMatrix * uMVMatrix * aVPos * aTimeDomainMul;
  // vFragPos = uMVMatrix * verPos;
  vTextureCoord = aTextureCoord;
  vec4 transformedPos = uProjectionMatrix * uMVMatrix * verPos;
  vec4 transformedNormal = normalize(uMVMatrix * vec4(faceNormal, 0.0));
  // vec4 transformedNormal = vec4(faceNormal, 1.0);
  vec3 lightDirection = normalize(uLightPos);
  vec3 ambientLight = uAmbientLightColor;
  vec3 specularColor = uSpecLightColor;
  vec3 directionalLightColor = uDirLightColor;
  vec3 eyeDirection = -normalize((uMVMatrix * verPos)).xyz;
  float directionalLightAmount = max(0.0, dot(transformedNormal.xyz, lightDirection));
  vec3 reflectionDirection = reflect(lightDirection, transformedNormal.xyz);
  float specularAmount = max(0.0, dot(eyeDirection, reflectionDirection));
  vLighting = ambientLight + directionalLightColor * directionalLightAmount +
  specularColor * pow(specularAmount, 0.5) * specularColor * pow(specularAmount, 2.0) * 20.0;
  // specularColor * specularAmount;
  gl_Position = uProjectionMatrix * uMVMatrix * verPos;
  // gl_Position = uMVMatrix * verPos;
}
