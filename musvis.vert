precision mediump float;
attribute vec4 aVPos;
attribute vec2 aTextureCoord;
uniform mat4 uMVMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTextureCoord;

void main () {
  gl_Position = uProjectionMatrix * uMVMatrix * aVPos;
  vTextureCoord = aTextureCoord;
}
