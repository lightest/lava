#include "stdio.h"

#include <emscripten/emscripten.h>

char str[4] = {'a', 'z', 'c', 'd'};
float floats[4] = {1.0, 2.0, 3.0, 4.0};

EMSCRIPTEN_KEEPALIVE
char *getStrAddr () {
  return str;
}

EMSCRIPTEN_KEEPALIVE
float *getFloatAddr () {
  return floats;
}

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
void printArray (float *arr, int len) {
  int i = 0;
  for (i = 0; i < len; i++) {
    printf("%f, ", arr[i]);
  }
  printf("\n");
}

EMSCRIPTEN_KEEPALIVE
void printCharArr (char* arr, int len) {
  int i = 0;
  for (i = 0; i < len; i++) {
    printf("%c", arr[i]);
  }
  printf("\n");
}

EMSCRIPTEN_KEEPALIVE
void calcNormals_test (float *vertices,
  int *indices,
  int indicesAmount,
  float *outNormals) {

}

EMSCRIPTEN_KEEPALIVE
void calculateNormals (
  float *vertices,
  int *indices,
  int indicesAmount,
  float *outNormals
) {
  int i = 0;
  float edge0[3] = {0, 0, 0};
  float edge1[3] = {0, 0, 0};
  float v0[3] = {0, 0, 0};
  float v1[3] = {0, 0, 0};
  float v2[3] = {0, 0, 0};
  float normal[3] = {0, 0, 0};

  for (i = 0; i < indicesAmount; i += 3) {
    outNormals[indices[i] * 3] = 0;
    outNormals[indices[i] * 3 + 1] = 0;
    outNormals[indices[i] * 3 + 2] = 0;
  }

  for (i = 0; i < indicesAmount; i += 3) {
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
  }
}
