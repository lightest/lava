window.AudioContext = (function(){
  return  window.webkitAudioContext || window.AudioContext || window.mozAudioContext;
})();

// eslint configs:
/*
  global Module
*/

var mainModule = (function () {
  class MainModule {
    constructor () {
      this.cnv = undefined;
      this._useWASM = false;
      this._gl = undefined;
      this._debugData = {};
      this._debugEl = undefined;
      this._waveFormDataFloat = undefined;
      this._renderBinded = this.render.bind(this);
      this._binded = {};
      this._bindFuncs([
        this.mainLoop,
        this._handleKeydown,
        this._beforeUnload
      ]);
      this._wasmData = undefined;
      this._planeData = undefined;
      this._lightPos = new Float32Array([-1, -.1, 0]);
      this._drawCfg = {
        drawMode: undefined,
        signalGain: 100.0,
        fade: .975,
        ambientLightColor: new Float32Array([0.45, 0.1, 0]),
        specularLightColor: new Float32Array([1.3, 0.45, 0.27]),
        directionalLightColor: new Float32Array([1, 0.1, 0])
      };
    }

    init () {
      this._mvMat = mat4.create();
      this._testImg = undefined;
      this._audioCtx = undefined;
      this._audioData = undefined;
      this._dataLen = 0;
      this._processedData = undefined;
      this._frequencyData = undefined;
      this._waveFormData = undefined;
      this._gl = undefined;
      this._pi = undefined;
      this.sourceNode = undefined;
      this.gainNode = undefined;
      this.analyserNode = undefined;
      this.cnv = document.querySelector('canvas');
      this.cnv.width = document.documentElement.clientWidth;
      this.cnv.height = document.documentElement.clientHeight;
      this.cnv.addEventListener('drop', this._handleFileDrop);
      this.cnv.addEventListener('dragover', function (e) {
        e.preventDefault();
      });
      this._debugEl = document.querySelector('.debug-data');
      this._setupAudioCtx();
      this._fetchShaders()
        .then(([vertexSrc, fragmentSrc, imgBlob]) => {
          this._testImg = new Image();
          this._testImg.src = URL.createObjectURL(imgBlob);
          this._setupWebgl(vertexSrc, fragmentSrc);
          this._drawCfg.drawMode = this._gl.TRIANGLES;
          this.mainLoop();
        });

      window.addEventListener('keydown', this._binded._handleKeydown);
      window.addEventListener('beforeunload', this._binded._beforeUnload);

      window.addEventListener('resize', (e) => {
        this.cnv.width = document.documentElement.clientWidth;
        this.cnv.height = document.documentElement.clientHeight;
        if (this._gl) {
          this._gl.viewport(0, 0, this.cnv.width, this.cnv.height);
          this._gl.uniform2fv(this._pi.unifs.uWindowSize, [this.cnv.width, this.cnv.height]);
        }
      });
    }

    _bindFuncs (methods = []) {
      let i;
      for (i = 0; i < methods.length; i++) {
        this._binded[methods[i].name] = methods[i].bind(this);
      }
    }

    _beforeUnload () {
      if (this._useWASM) {
        Module.asm.free(this._wasmData.verticesPtr);
        Module.asm.free(this._wasmData.indicesPtr);
        Module.asm.free(this._wasmData.normalsPtr);
      }
    }

    _handleKeydown (e) {
      console.log(e.which);
      if (e.which === 32) {
        if (mainModule._audioData === undefined) {
          fetch('./ps.mp3')
            .then((resp) => {
              console.log('fetched music, processing...');
              return resp.arrayBuffer();
            })
            .then((arrayBuffer) => {
              mainModule._decodeAndPlay(arrayBuffer);
            });
        }
        if (mainModule._audioCtx.state === 'suspended') {
          mainModule._audioCtx.resume();
        }
        if (mainModule._audioCtx.state === 'running') {
          mainModule._audioCtx.suspend();
        }
      }

      if (e.which >= 37 && e.which <= 40) {
        let rotAxis = [0, 0, 0];
        let k = 1;
        if (e.which === 37) {
          k = -1;
          rotAxis = [0, 0, 1];
        }
        if (e.which === 39) {
          k = 1;
          rotAxis = [0, 0, 1];
        }
        if (e.which === 38) {
          k = -1;
          rotAxis = [1, 0, 0];
        }
        if (e.which === 40) {
          k = 1;
          rotAxis = [1, 0, 0];
        }
        mat4.rotate(
          this._mvMat,
          this._mvMat,
          Math.PI * .01 * k,
          rotAxis
        );
      }

      if (e.which === 87 || e.which === 83
        || e.which === 65 || e.which === 68
        || e.which === 69 || e.which === 81) {
        let translationAxis = [0, 0, 0];
        if (e.which === 87) {
          translationAxis[1] = .7;
        }
        if (e.which === 83) {
          translationAxis[1] = -.7;
        }
        if (e.which === 65) {
          translationAxis[0] = -.7;
        }
        if (e.which === 68) {
          translationAxis[0] = .7;
        }
        if (e.which === 81) {
          translationAxis[2] = .7;
        }
        if (e.which === 69) {
          translationAxis[2] = -.7;
        }
        mat4.translate(
          this._mvMat,
          this._mvMat,
          translationAxis
        );
      }
    }

    _setupAudioCtx () {
      this._audioCtx = new AudioContext();
      this.sourceNode = this._audioCtx.createBufferSource();
      this.analyserNode = this._audioCtx.createAnalyser();
      this.gainNode = this._audioCtx.createGain();
      this.sourceNode.connect(this.gainNode);
      this.sourceNode.connect(this.analyserNode);
      this.gainNode.connect(this._audioCtx.destination);
      this.analyserNode.fftSize = 256;
      this._dataLen = this.analyserNode.fftSize;
      // this._dataLen = 64;
      // this._frequencyData = new Float32Array(this._dataLen);
      this._frequencyData = new Uint8Array(this._dataLen);
      this._frequencyDataFloat = new Float32Array(this._dataLen);
      this._waveFormDataFloat = new Float32Array(this._dataLen);
      this._waveFormData = new Uint8Array(this._dataLen);
      this._processedData = new Uint8Array(this._dataLen);
    }

    async _fetchShaders () {
      let reqs = [
        fetch('./musvis.vert'),
        fetch('./musvis.frag'),
        fetch('./undertow.webp')
      ];
      let [resp0, resp1, resp2] = await Promise.all(reqs);
      return await Promise.all([resp0.text(), resp1.text(), resp2.blob()]);
    }

    _generatePlaneDataWASM (n = 9) {
      let i;
      let quadSize = Math.sqrt(n);
      let offset = 0;
      // for n = 9:
      // out of 9 vertices we'll visit only 4 of them,
      // subtracting edge on the top and on the right.
      // Each of 4 vertices will generate 6 indices entries,
      // thus indicesLen = (amountOfVertices - twoEdgesWithOneSharedVertex) * 6;
      // * * *
      // x x *
      // x x *
      //
      let indicesLen = (n - (quadSize * 2 - 1)) * 6;
      if (quadSize % 2 == 0) {
        offset = -quadSize * .5;
      } else {
        offset = -(quadSize - 1) * .5;
      }
      let entry;
      let vertices;
      let indices;
      let normals;
      let verticesPtr = Module.asm.malloc(n * 3 * 4);
      let indicesPtr = Module.asm.malloc(indicesLen * 4);
      let normalsPtr = Module.asm.malloc(n * 3 * 4);
      for (i = 0; i < n; i++) {
        Module.HEAPF32[ verticesPtr / 4 + i * 3 ] = i % quadSize + offset;
        Module.HEAPF32[ verticesPtr / 4 + i * 3 + 1 ] = Math.floor(i / quadSize + offset);
        Module.HEAPF32[ verticesPtr / 4 + i * 3 + 2 ] = 0.0;
      }
      entry = indicesPtr / 4;
      for (i = 0; i < n - quadSize; i++) {
        if (i % quadSize < quadSize - 1) {
          Module.HEAPU32[entry] = i;
          Module.HEAPU32[entry + 1] = i + 1;
          Module.HEAPU32[entry + 2] = i + 1 + quadSize;
          Module.HEAPU32[entry + 3] = i;
          Module.HEAPU32[entry + 4] = i + 1 + quadSize;
          Module.HEAPU32[entry + 5] = i + quadSize;
          entry += 6;
        }
      }
      Module.asm.calculateNormals(verticesPtr, indicesPtr, indicesLen, normalsPtr);

      vertices = new Float32Array(Module.HEAPF32.buffer, verticesPtr, n * 3);
      indices = new Uint32Array(Module.HEAPU32.buffer, indicesPtr, indicesLen);
      normals = new Float32Array(Module.HEAPF32.buffer, normalsPtr, n * 3);

      this._wasmData = {verticesPtr, indicesPtr, normalsPtr};
      this._planeData = {vertices, indices, normals};
    }

    _generatePlaneData (n = 9) {
      let i;
      let quadSize = Math.sqrt(n);
      let offset = 0;
      if (quadSize % 2 == 0) {
        offset = -quadSize * .5;
      } else {
        offset = -(quadSize - 1) * .5;
      }
      let entry = 0;
      let normals;
      let indicesLen = (n - (quadSize * 2 - 1)) * 6;
      let vertices = new Float32Array(n * 3);
      let indices = new Uint32Array(indicesLen);
      for (i = 0; i < n; i++) {
        vertices[i * 3] = i % quadSize + offset;
        vertices[i * 3 + 1] = Math.floor(i / quadSize + offset);
        vertices[i * 3 + 2] = 0.0;
      }
      for (i = 0; i < n - quadSize; i++) {
        if (i % quadSize < quadSize - 1) {
          indices[entry] = i;
          indices[entry + 1] = i + 1;
          indices[entry + 2] = i + 1 + quadSize;
          indices[entry + 3] = i;
          indices[entry + 4] = i + 1 + quadSize;
          indices[entry + 5] = i + quadSize;
          entry += 6;
        }
      }
      normals = this._calculateNormals(vertices, indices);

      return {vertices, indices, normals};
    }

    _calculateNormals (vertices = [], indices = []) {
      let t = performance.now();
      let i = 0;
      let finalNormals;
      if (this._planeData === undefined) {
        finalNormals = new Float32Array(vertices.length).fill(0);
      } else {
        finalNormals = this._planeData.normals.fill(0);
      }
      let edge0 = [0, 0, 0], edge1 = [0, 0, 0];
      let v0, v1, v2;
      let normal;
      // v0 = vec3.create();
      // v1 = vec3.create();
      // v2 = vec3.create();

      v0 = [0, 0, 0];
      v1 = [0, 0, 0];
      v2 = [0, 0, 0];
      for (i = 0; i < indices.length; i += 3) {
        v0[0] = vertices[indices[i] * 3];
        v0[1] = vertices[indices[i] * 3 + 1];
        v0[2] = vertices[indices[i] * 3 + 2];

        v1[0] = vertices[indices[i + 1] * 3];
        v1[1] = vertices[indices[i + 1] * 3 + 1];
        v1[2] = vertices[indices[i + 1] * 3 + 2];

        v2[0] = vertices[indices[i + 2] * 3];
        v2[1] = vertices[indices[i + 2] * 3 + 1];
        v2[2] = vertices[indices[i + 2] * 3 + 2];

        normal = [0, 0, 0];

        vec3.subtract(edge0, v1, v0);
        vec3.subtract(edge1, v2, v0);
        vec3.cross(normal, edge0, edge1);

        finalNormals[indices[i] * 3] += normal[0];
        finalNormals[indices[i] * 3 + 1] += normal[1];
        finalNormals[indices[i] * 3 + 2] += normal[2];
      }

      // console.log('normals calc time', performance.now() - t);
      return finalNormals;
    }

    _createShader (src, type) {
      let info;
      let shader = this._gl.createShader(type);
      this._gl.shaderSource(shader, src);
      this._gl.compileShader(shader);
      if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
        info = this._gl.getShaderInfoLog(shader);
        console.log(info);
        return null;
      }
      return shader;
    }

    _getAttribLocations (program, locNames = []) {
      let locs = {};
      let i;
      for (i of locNames) {
        locs[i] = this._gl.getAttribLocation(program, i);
      }
      return locs;
    }

    _getUniformLocations (program, locNames = []) {
      let locs = {};
      let i;
      for (i of locNames) {
        locs[i] = this._gl.getUniformLocation(program, i);
      }
      return locs;
    }

    _setupWebgl (vertexSrc, fragmentSrc) {
      this._gl = this.cnv.getContext('webgl2');
      this._gl.clearColor(0, 0, 0, 1);
      this._gl.clearDepth(1.0);
      this._gl.enable(this._gl.DEPTH_TEST);
      this._gl.depthFunc(this._gl.LEQUAL);
      let verticesAmount = 256 ** 2;
      let vertShader = this._createShader(vertexSrc, this._gl.VERTEX_SHADER);
      let fragShader = this._createShader(fragmentSrc, this._gl.FRAGMENT_SHADER);
      let program = this._gl.createProgram();
      this._gl.attachShader(program, vertShader);
      this._gl.attachShader(program, fragShader);
      this._gl.linkProgram(program);
      if (!this._gl.getProgramParameter(program, this._gl.LINK_STATUS)) {
        console.log(this._gl.getProgramInfoLog(program));
        return null;
      }
      let pi = {
        program,
        attrs: this._getAttribLocations(program, [
          'aVPos',
          'aTextureCoord',
          'aTimeDomainMul',
          'aAdjacentV0',
          'aAdjacentV1',
          'aNormal'
        ]),
        unifs: this._getUniformLocations(program, [
          'uProjectionMatrix',
          'uMVMatrix',
          'uLightPos',
          't',
          'uWindowSize',
          'uSampler',
          'uAmbientLightColor',
          'uSpecLightColor',
          'uDirLightColor'
        ]),
        drawData: {
          offset: 0,
          vCount: 0
        },
      };
      this._pi = pi;
      this._tex = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._tex);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      if (this._useWASM) {
        this._generatePlaneDataWASM(verticesAmount);
      } else {
        this._planeData = this._generatePlaneData(verticesAmount);
      }
      // let planePos = [
      //   -1.0, -1.0,  1.0,
      //   1.0, -1.0,  1.0,
      //   1.0,  1.0,  1.0,
      //   -1.0,  1.0,  1.0,
      //   -1.0, -1.0, -1.0,
      //   -1.0,  1.0, -1.0,
      //   1.0,  1.0, -1.0,
      //   1.0, -1.0, -1.0,

      // ];
      let texCoords = [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
      ];
      // let indices = [
      //   0, 1, 2,
      //   0, 2, 3,
      //   4, 5, 6,
      //   4, 6, 7,

      // ];
      this._posBuf = this._gl.createBuffer();
      this._texBuf = this._gl.createBuffer();
      this._indexBuf = this._gl.createBuffer();
      this._tdBuf = this._gl.createBuffer();
      this._normalsBuf = this._gl.createBuffer();
      this._adjacentVerticesBuf = this._gl.createBuffer();
      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._indexBuf);
      this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, this._planeData.indices, this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._texBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(texCoords), this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aTextureCoord, 2, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aTextureCoord);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._posBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._planeData.vertices, this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aVPos, 3, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aVPos);

      // this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._tdBuf);
      // this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(verticesAmount).fill(1.0), this._gl.STATIC_DRAW);
      // this._gl.vertexAttribPointer(this._pi.attrs.aTimeDomainMul, 1, this._gl.FLOAT, false, 0, 0);
      // this._gl.enableVertexAttribArray(this._pi.attrs.aTimeDomainMul);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._normalsBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._planeData.normals, this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aNormal, 3, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aNormal);

      this._gl.useProgram(program);

      let fov = 90 * Math.PI / 180;
      let aspect = this.cnv.width / this.cnv.height;
      let zNear = .1;
      let zFar = 1000.0;
      let projectionMat = mat4.create();
      mat4.perspective(
        projectionMat,
        fov,
        aspect,
        zNear,
        zFar
      );
      mat4.translate(
        this._mvMat,
        this._mvMat,
        [.0, .0, -70.0]
      );
      mat4.rotate(
        this._mvMat,
        this._mvMat,
        Math.PI * -.15,
        [1, 0, 0]
      );
      this._gl.uniform1i(this._pi.unifs.uSampler, 0);
      this._gl.uniformMatrix4fv(
        pi.unifs.uProjectionMatrix,
        false,
        projectionMat
      );
      this._gl.uniformMatrix4fv(
        pi.unifs.uMVMatrix,
        false,
        this._mvMat
      );
      this._pi.drawData.offset = 0;
      this._pi.drawData.vCount = verticesAmount;
      this._gl.uniform2fv(this._pi.unifs.uWindowSize, [this.cnv.width, this.cnv.height]);
      this._gl.uniform3fv(this._pi.unifs.uLightPos, this._lightPos);
    }

    _decodeAndPlay (arrayBuffer) {
      this._audioCtx.decodeAudioData(arrayBuffer, function (buffer) {
        mainModule._audioData = buffer;
        mainModule.play(buffer);
      });
    }

    _handleFileDrop (e) {
      e.preventDefault();
      mainModule._setupAudioCtx();
      let r = new FileReader();
      r.onload = function (readRes) {
        console.log(readRes);
        mainModule._decodeAndPlay(readRes.target.result);
      };
      r.readAsArrayBuffer(e.dataTransfer.files[0]);
    }

    _applySineWaveToVertices (vertices, elapsedTime) {
      let verticesAmount = vertices.length / 3;
      let side = Math.sqrt(verticesAmount);
      let i;
      let row = 0;
      let a = 0;
      for (i = 0; i < verticesAmount; i++) {
        row = Math.floor(i / side);
        a = elapsedTime * .007 + row * .2;
        vertices[i * 3 + 2] = Math.sin(a) * 2.0;
      }
    }

    play (buffer) {
      console.log('playing...');
      this.sourceNode.buffer = buffer;
      this.sourceNode.start(0);
      this.sourceNode.loop = true;
    }

    stopPlayBack () {
      this.sourceNode.stop(0);
    }

    _pushDataDownThePlaneWASM (data = []) {
      if (data.length === 0) {
        return;
      }
      let i;
      let vertices = this._planeData.vertices;
      let c = 0;
      for (i = 0; i < data.length; i++) {
        if (data[i] * this._drawCfg.signalGain === vertices[i * 3 + 2]) {
          c++;
        }
      }
      if (c === data.length) {
        return;
      }
      let dataLen = Math.min(data.length, vertices.length / 3);
      let side = Math.sqrt(vertices.length / 3);
      let verticesPtr = this._wasmData.verticesPtr;
      for (i = vertices.length - 1; i >= side * 3; i -= 3) {
        Module.HEAPF32[verticesPtr / 4 + i] = vertices[i - side * 3] * this._drawCfg.fade;
        vertices[i] = vertices[i - side * 3] * this._drawCfg.fade;
        // vertices[i - 1] = vertices[i - 1 - side * 3];
        // vertices[i - 2] = vertices[i - 2 - side * 3];
      }
      for (i = 0; i < dataLen; i++) {
        Module.HEAPF32[verticesPtr / 4 + i * 3 + 2] = data[i] * this._drawCfg.signalGain;
        vertices[i * 3 + 2] = data[i] * this._drawCfg.signalGain;
      }
    }

    _pushDataDownThePlane (data = []) {
      if (data.length === 0) {
        return;
      }
      let i;
      let vertices = this._planeData.vertices;
      let c = 0;
      for (i = 0; i < data.length; i++) {
        if (data[i] * this._drawCfg.signalGain === vertices[i * 3 + 2]) {
          c++;
        }
      }
      if (c === data.length) {
        return;
      }
      let side = Math.sqrt(vertices.length / 3);
      for (i = vertices.length - 1; i >= side * 3; i -= 3) {
        vertices[i] = vertices[i - side * 3] * this._drawCfg.fade;
        // vertices[i - 1] = vertices[i - 1 - side * 3];
        // vertices[i - 2] = vertices[i - 2 - side * 3];
      }
      for (i = 0; i < data.length; i++) {
        vertices[i * 3 + 2] = data[i] * this._drawCfg.signalGain;
      }
    }

    _copyAudioDataToPlane () {
      let i;
      let availDataLen;
      let vertices = this._planeData.vertices;
      // let newAdjacentVerticesData = this._planeData.adjacent.slice();
      if (this.analyserNode === undefined) {
        return;
      }
      this.analyserNode.getFloatTimeDomainData(this._waveFormDataFloat);
      this.analyserNode.getByteTimeDomainData(this._waveFormData);
      this.analyserNode.getFloatFrequencyData(this._frequencyDataFloat);
      this.analyserNode.getByteFrequencyData(this._frequencyData);
      availDataLen = Math.min(vertices.length, this._waveFormDataFloat.length);
      this._processedData = new Uint8Array([...this._waveFormData, ...this._frequencyData]);
      if (this._useWASM) {
        this._pushDataDownThePlaneWASM(this._waveFormDataFloat);
      } else {
        this._pushDataDownThePlane(this._waveFormDataFloat);
      }
      // for (i = 0; i < availDataLen; i++) {
      //   vertices[i * 3 + 2] = this._waveFormDataFloat[i] * 4.0;
        // newAdjacentVerticesData[i * 6 + 2] = this._waveFormDataFloat[i] * 4.0;
        // newAdjacentVerticesData[3 + i * 6 + 2] = this._waveFormDataFloat[i] * 4.0;
      // }
    }

    update () {
      this._copyAudioDataToPlane();
      let t = performance.now();
      if (this._useWASM) {
        Module.asm.calculateNormals(
          this._wasmData.verticesPtr,
          this._wasmData.indicesPtr,
          this._planeData.indices.length,
          this._wasmData.normalsPtr
        );
        this._planeData.normals = new Float32Array(Module.HEAPF32.buffer, this._wasmData.normalsPtr, this._planeData.normals.length);
        // console.log('normals calc took', performance.now() - t);
      } else {
        this._calculateNormals(this._planeData.vertices, this._planeData.indices);
      }
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._posBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._planeData.vertices, this._gl.STATIC_DRAW);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._normalsBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._planeData.normals, this._gl.STATIC_DRAW);
      this._gl.uniform3fv(this._pi.unifs.uAmbientLightColor, this._drawCfg.ambientLightColor);
      this._gl.uniform3fv(this._pi.unifs.uSpecLightColor, this._drawCfg.specularLightColor);
      this._gl.uniform3fv(this._pi.unifs.uDirLightColor, this._drawCfg.directionalLightColor);
    }

    render () {
      // this._applySineWaveToVertices(newVertexData, performance.now());
      // for (i = 0; i < this._dataLen; i++) {
      //   value = this._waveFormData[i] / 256;
      //   x = i * (1920 / 1024);
      //   c = Math.cos(x * .05 - this._audioCtx.currentTime /* * avrgWaveForm * .0001*/) * 1;
      //   y = (this.cnv.height - (this.cnv.height * value * 50 ) - 1)  - this.cnv.height * .5;
      // }
      this._gl.uniform1f(this._pi.unifs.t, performance.now());
      this._gl.uniform3fv(this._pi.unifs.uLightPos, this._lightPos);
      // mat4.rotate(
      //   this._mvMat,
      //   this._mvMat,
      //   Math.PI*.001,
      //   [1, 0, 0]
      // );
      // let normalMatrix = mat4.create();
      // mat4.invert();
      this._gl.uniformMatrix4fv(
        this._pi.unifs.uMVMatrix,
        false,
        this._mvMat
      );
      let level = 0;
      let internalFormat = this._gl.LUMINANCE;
      let width = 4096;
      let height = 1;
      let border = 0;
      let srcFormat = this._gl.LUMINANCE;
      let srcType = this._gl.UNSIGNED_BYTE;
      if (!this._testImg || !this._testImg.complete) {
        return;
      }
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._tdBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, this._waveFormDataFloat, this._gl.STATIC_DRAW);

      // this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._adjacentVerticesBuf);
      // this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(newAdjacentVerticesData), this._gl.STATIC_DRAW);


      // this._gl.texImage2D(
      //   this._gl.TEXTURE_2D,
      //   level,
      //   internalFormat,
      //   srcFormat,
      //   srcType,
      //   this._testImg
      // );

      // this._gl.texImage2D(
      //   this._gl.TEXTURE_2D,
      //   level,
      //   internalFormat,
      //   width,
      //   height,
      //   border,
      //   srcFormat,
      //   srcType,
      //   this._processedData
      //   // this._waveFormData
      //   // new Uint8Array([0,0,255,255,0,255,0,255])
      // );
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.uniform1i(this._pi.unifs.uSampler, 0);

      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.drawElements(this._drawCfg.drawMode, this._planeData.indices.length, this._gl.UNSIGNED_INT, 0);
      // this._gl.drawArrays(this._gl.TRIANGLES, 0, 4);
    }

    mainLoop () {
      requestAnimationFrame(this._binded.mainLoop);
      this.update();
      this.render();
    }
  }

  return new MainModule();
})();


window.onload = function () {
  mainModule.init();
};
