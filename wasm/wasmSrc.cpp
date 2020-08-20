#include "stdio.h"
#include <algorithm>
#include "math.h"
#include <emscripten/emscripten.h>

extern "C" {//--disable-frame-rate-limit --disable-gpu-vsync

void vec3Subtract (float *out, float *a, float *b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
}

void vec3Cross (float *out, float *a, float *b) {
  float ax = a[0];
  float ay = a[1];
  float az = a[2];
  float bx = b[0];
  float by = b[1];
  float bz = b[2];

  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
}

EMSCRIPTEN_KEEPALIVE
void updatePlaneData (float* waveFormData, int waveFormDataLen, float* verticesPtr, int verticesLen, float signalGain, float fade, int rowStep, float dt) {
  dt /= 1000;
  int i, j;
  int row;
  int dataLen = std::min(waveFormDataLen, verticesLen);
  int side = sqrt(verticesLen / 3);
  int rowsUpd = std::min((float)side, std::max(1.0f, floor(rowStep * dt)));
  int rowStepPerFrame = side * 3 * rowsUpd;
  float fadePower = pow(fade, rowsUpd);
  // for (i = verticesLen - 1; i >= side * 3; i -= 3) {
  //   row = floor(i / 3 / side);
  //   verticesPtr[i] = verticesPtr[i - side * 3] * (1.0f - row / (side - 1));
  // }

  for (i = verticesLen - 1; i >= rowStepPerFrame; i -= 3) {
    verticesPtr[i] = verticesPtr[i - rowStepPerFrame] * fadePower;// * pow(fade, floor(i / 3 / side) + 1);
  }

  for (i = 0; i < dataLen; i++) {
    for (j = 0; j < rowsUpd; j++) {
      verticesPtr[(i + side * j) * 3 + 2] = waveFormData[i] * signalGain * pow(fade, j); // * sin(M_PI * j / rowsUpd) * 2.0;
    }
  }
}

EMSCRIPTEN_KEEPALIVE
void calculateNormals (
  float *vertices,
  int *indices,
  int indicesAmount,
  int verticesAmount,
  float *outNormals
) {
  int i = 0;
  float edge0[3];
  float edge1[3];
  float v0[3];
  float v1[3];
  float v2[3];
  float normal[3];

  for (i = 0; i < verticesAmount; i += 3) {
    outNormals[i] = 0;
    outNormals[i + 1] = 0;
    outNormals[i + 2] = 0;
  }

  for (i = 0; i < indicesAmount; i += 3) {
    // if (i % 6 == 0) {
    //   outNormals[indices[i] * 3] = 0;
    //   outNormals[indices[i] * 3 + 1] = 0;
    //   outNormals[indices[i] * 3 + 2] = 0;
    // }
    v0[0] = vertices[indices[i] * 3];
    v0[1] = vertices[indices[i] * 3 + 1];
    v0[2] = vertices[indices[i] * 3 + 2];

    v1[0] = vertices[indices[i + 1] * 3];
    v1[1] = vertices[indices[i + 1] * 3 + 1];
    v1[2] = vertices[indices[i + 1] * 3 + 2];

    v2[0] = vertices[indices[i + 2] * 3];
    v2[1] = vertices[indices[i + 2] * 3 + 1];
    v2[2] = vertices[indices[i + 2] * 3 + 2];

    vec3Subtract(edge0, v1, v0);
    vec3Subtract(edge1, v2, v0);
    vec3Cross(normal, edge0, edge1);

    outNormals[indices[i] * 3] += normal[0];
    outNormals[indices[i] * 3 + 1] += normal[1];
    outNormals[indices[i] * 3 + 2] += normal[2];

    // without these surface looks more like liquid/silk wich is what we want

    // outNormals[indices[i + 1] * 3] += normal[0];
    // outNormals[indices[i + 1] * 3 + 1] += normal[1];
    // outNormals[indices[i + 1] * 3 + 2] += normal[2];

    // outNormals[indices[i + 2] * 3] += normal[0];
    // outNormals[indices[i + 2] * 3 + 1] += normal[1];
    // outNormals[indices[i + 2] * 3 + 2] += normal[2];
  }
}

}
