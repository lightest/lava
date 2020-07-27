window.AudioContext = (function(){
  return  window.webkitAudioContext || window.AudioContext || window.mozAudioContext;
})();

var mainModule = (function () {
  class MainModule {
    constructor () {
      this.cnv = undefined;
      this._gl = undefined;
      this._debugData = {};
      this._debugEl = undefined;
      this._waveFormDataFloat = undefined;
      this._renderBinded = this.render.bind(this);
      this._binded = {};
      this._bindFuncs([
        this.mainLoop,
        this._handleKeydown
      ]);
      this._lightPos = [0, 0, 0];
      this._drawCfg = {
        drawMode: undefined
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
      this._dataLen = this.analyserNode.fftSize;
      // this._frequencyData = new Float32Array(this._dataLen);
      this._frequencyData = new Uint8Array(this._dataLen);
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

    _generatePlaneData (n = 9) {
      let i;
      let quadSize = Math.sqrt(n);
      let offset = 0;
      if (quadSize % 2 == 0) {
        offset = -quadSize * .5;
      } else {
        offset = -(quadSize - 1) * .5;
      }
      let vertices = [];
      let indices = [];
      let adjacent = [];
      let normals;
      let aIdx = 0;
      for (i = 0; i < n; i++) {
        vertices.push(i % quadSize + offset, Math.floor(i / quadSize + offset), 0.0);
      }
      for (i = 0; i < n - quadSize; i++) {
        if (i % quadSize < quadSize - 1) {
          indices.push(
            i, i + 1, i + 1 + quadSize,
            i, i + 1 + quadSize, i + quadSize
          );
        } else {
          continue;
        }
      }
      for (i = 0; i < n; i++) {
        if (i % quadSize < quadSize - 1) {
          // triangles have two adjacent vertices
          // adding them to calc stuff in the vertex shader
          aIdx = (i + 1) * 3;
          adjacent.push(vertices[aIdx], vertices[aIdx + 1], vertices[aIdx + 2]);
          aIdx = (i + 1 + quadSize) * 3;
          adjacent.push(vertices[aIdx], vertices[aIdx + 1], vertices[aIdx + 2]);
        } else {
          aIdx = (i - 1) * 3;
          adjacent.push(vertices[aIdx], vertices[aIdx + 1], vertices[aIdx + 2]);
          aIdx = (i + quadSize) * 3;
          adjacent.push(vertices[aIdx], vertices[aIdx + 1], vertices[aIdx + 2]);
        }
      }
      normals = this._calculateNormals(vertices, indices);

      return {vertices, indices, adjacent, normals};
    }

    _calculateNormals (vertices = [], indices = []) {
      let i = 0, j = 0;
      let normals = [];
      let finalNormals = [];
      let storage;
      let edge0 = [], edge1 = [];
      let v0, v1, v2;
      let normal;
      v0 = vec3.create();
      v1 = vec3.create();
      v2 = vec3.create();
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

        normal = vec3.create();

        vec3.subtract(edge0, v1, v0);
        vec3.subtract(edge1, v2, v0);
        vec3.cross(normal, edge0, edge1);

        for (j = i; j < i + 3; j++) {
          storage = normals[indices[j]];
          if (storage === undefined) {
            storage = [];
            normals[indices[j]] = storage;
          }
          storage.push(normal);
        }
      }
      for (i = 0; i < normals.length; i++) {
        normal = vec3.create();
        for (j = 0; j < normals[i].length; j++) {
          normal[0] += normals[i][j][0];
          normal[1] += normals[i][j][1];
          normal[2] += normals[i][j][2];
        }
        vec3.normalize(normal, normal);
        finalNormals.push(normal[0], normal[1], normal[2]);
      }
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
      let verticesAmount = 2304;
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
          'uSampler'
        ]),
        drawData: {
          offset: 0,
          vCount: 0
        },
        vertexCount: 0
      };
      this._pi = pi;
      this._tex = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._tex);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      let planeData = this._generatePlaneData(verticesAmount);
      let planePos = planeData.vertices;
      let indices = planeData.indices;
      this._planeData = planeData;
      pi.vertexCount = indices.length;
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
      this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._texBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(texCoords), this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aTextureCoord, 2, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aTextureCoord);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._posBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(planePos), this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aVPos, 3, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aVPos);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._tdBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(verticesAmount).fill(1.0), this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aTimeDomainMul, 1, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aTimeDomainMul);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._adjacentVerticesBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(planeData.adjacentVertices), this._gl.STATIC_DRAW);
      this._gl.vertexAttribPointer(this._pi.attrs.aAdjacentV0, 3, this._gl.FLOAT, false, 4 * 3, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aAdjacentV0);
      this._gl.vertexAttribPointer(this._pi.attrs.aAdjacentV1, 3, this._gl.FLOAT, false, 4 * 3, 4 * 3);
      this._gl.enableVertexAttribArray(this._pi.attrs.aAdjacentV1);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._normalsBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(planeData.normals), this._gl.STATIC_DRAW);
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
      let vCount = planePos.length / 3;
      this._pi.drawData.offset = 0;
      this._pi.drawData.vCount = vCount;
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
      for (i = 0; i < verticesAmount; i++) {
        row = Math.floor(i / side);
        vertices[i * 3 + 2] = Math.sin(elapsedTime * .007 + row * .1) * 2.0;
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

    update () {

    }

    render () {
      let i;
      let normals;
      let x, y;
      let value;
      let avrgWaveForm = 0;
      let rgba = [0, 0, 0, .1];
      let c;
      let availDataLen;
      let newVertexData = this._planeData.vertices.slice();
      let newAdjacentVerticesData = this._planeData.adjacent.slice();
      if (this.analyserNode === undefined) {
        return;
      }
      this.analyserNode.getFloatTimeDomainData(this._waveFormDataFloat);
      this.analyserNode.getByteTimeDomainData(this._waveFormData);
      // this.analyserNode.getFloatFrequencyData(this._frequencyData);
      this.analyserNode.getByteFrequencyData(this._frequencyData);
      availDataLen = Math.min(newVertexData.length, this._waveFormDataFloat.length);
      for (i = 0; i < availDataLen; i++) {
        newVertexData[i * 3 + 2] = this._waveFormDataFloat[i] * 4.0;
        newAdjacentVerticesData[i * 6 + 2] = this._waveFormDataFloat[i] * 4.0;
        newAdjacentVerticesData[3 + i * 6 + 2] = this._waveFormDataFloat[i] * 4.0;
      }

      // this._applySineWaveToVertices(newVertexData, performance.now());

      normals = this._calculateNormals(newVertexData, this._planeData.indices);
      this._processedData = new Uint8Array([...this._waveFormData, ...this._frequencyData]);
      // for (i = 0; i < this._dataLen; i++) {
      //   value = this._waveFormData[i] / 256;
      //   x = i * (1920 / 1024);
      //   c = Math.cos(x * .05 - this._audioCtx.currentTime /* * avrgWaveForm * .0001*/) * 1;
      //   y = (this.cnv.height - (this.cnv.height * value * 50 ) - 1)  - this.cnv.height * .5;
      // }
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
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
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._posBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(newVertexData), this._gl.STATIC_DRAW);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._adjacentVerticesBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(newAdjacentVerticesData), this._gl.STATIC_DRAW);

      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._normalsBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(normals), this._gl.STATIC_DRAW);
      // this._gl.texImage2D(
      //   this._gl.TEXTURE_2D,
      //   level,
      //   internalFormat,
      //   srcFormat,
      //   srcType,
      //   this._testImg
      // );

      this._gl.texImage2D(
        this._gl.TEXTURE_2D,
        level,
        internalFormat,
        width,
        height,
        border,
        srcFormat,
        srcType,
        this._processedData
        // this._waveFormData
        // new Uint8Array([0,0,255,255,0,255,0,255])
      );
      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.uniform1i(this._pi.unifs.uSampler, 0);
      this._gl.drawElements(this._drawCfg.drawMode, this._pi.vertexCount, this._gl.UNSIGNED_SHORT, 0);
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
