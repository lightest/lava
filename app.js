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
      this._renderBinded = this.render.bind(this);
    }

    init () {
      this._testImg = undefined;
      this._audioCtx = undefined;
      this._audioData = undefined;
      this._dataLen = 0;
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
          this.render();
        });

      window.addEventListener('keydown', function (e) {
        if (e.which === 32) {
          if (mainModule._audioData === undefined) {
            fetch('./pb.mp3')
              .then((resp) => {
                console.log('fetched music, processing...');
                return resp.arrayBuffer();
              })
              .then((arrayBuffer) => {
                mainModule._decodeAndPlay(arrayBuffer);
              });
          } else if (mainModule._audioCtx.state === 'suspended') {
            mainModule._audioCtx.resume();
          } else if (mainModule._audioCtx.state === 'running') {
            mainModule._audioCtx.suspend();
          }
        }
      });

      window.addEventListener('resize', (e) => {
        this.cnv.width = document.documentElement.clientWidth;
        this.cnv.height = document.documentElement.clientHeight;
        if (this._gl) {
          this._gl.viewport(0, 0, this.cnv.width, this.cnv.height);
          this._gl.uniform2fv(this._pi.unifs.uWindowSize, [this.cnv.width, this.cnv.height]);
        }
      });
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
      this._frequencyData = new Float32Array(this._dataLen);
      // this._waveFormData = new Float32Array(this._dataLen);
      this._waveFormData = new Uint8Array(this._dataLen);
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
          'aTextureCoord'
        ]),
        unifs: this._getUniformLocations(program, [
          'uProjectionMatrix',
          'uMVMatrix',
          't',
          'uWindowSize',
          'uSampler'
        ]),
        drawData: {
          offset: 0,
          vCount: 0
        }
      };
      this._pi = pi;
      this._tex = this._gl.createTexture();
      this._gl.bindTexture(this._gl.TEXTURE_2D, this._tex);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
      let planePos = [
        -1.0, 1.0,
        1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0,
      ];
      let texCoords = [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
      ];
      let indices = [
        0, 1, 2,
        0, 2, 3
      ];
      let posBuf = this._gl.createBuffer();
      let texBuf = this._gl.createBuffer();
      let indexBuf = this._gl.createBuffer();
      this._posBuf = posBuf;
      this._texBuf = texBuf;
      this._indexBuf = indexBuf;
      this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, indexBuf);
      this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this._gl.STATIC_DRAW);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, texBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(texCoords), this._gl.STATIC_DRAW);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, posBuf);
      this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(planePos), this._gl.STATIC_DRAW);
      let fov = 90 * Math.PI / 180;
      let aspect = this.cnv.width / this.cnv.height;
      let zNear = .1;
      let zFar = 100.0;
      let projectionMat = mat4.create();
      let mvMat = mat4.create();
      mat4.perspective(
        projectionMat,
        fov,
        aspect,
        zNear,
        zFar
      );
      mat4.translate(
        mvMat,
        mvMat,
        [.0, .0, -2.0]
      );
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, posBuf);
      this._gl.vertexAttribPointer(this._pi.attrs.aVPos, 2, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aVPos);
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, texBuf);
      this._gl.vertexAttribPointer(this._pi.attrs.aTextureCoord, 2, this._gl.FLOAT, false, 0, 0);
      this._gl.enableVertexAttribArray(this._pi.attrs.aTextureCoord);
      this._gl.useProgram(program);
      this._gl.uniform1i(this._pi.unifs.uSampler, 0);
      this._gl.uniformMatrix4fv(
        pi.unifs.uProjectionMatrix,
        false,
        projectionMat
      );
      this._gl.uniformMatrix4fv(
        pi.unifs.uMVMatrix,
        false,
        mvMat
      );
      let vCount = planePos.length / 2;
      this._pi.drawData.offset = 0;
      this._pi.drawData.vCount = vCount;
      this._gl.uniform2fv(this._pi.unifs.uWindowSize, [this.cnv.width, this.cnv.height]);
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

    play (buffer) {
      console.log('playing...');
      this.sourceNode.buffer = buffer;
      this.sourceNode.start(0);
      this.sourceNode.loop = true;
    }

    stopPlayBack () {
      this.sourceNode.stop(0);
    }

    render () {
      requestAnimationFrame(this._renderBinded);
      let i;
      let x, y;
      let value;
      let avrgWaveForm = 0;
      let rgba = [0, 0, 0, .1];
      let c;
      if (this.analyserNode === undefined) {
        return;
      }
      for (i = 0; i < this._waveFormData.length; i++) {
        avrgWaveForm += this._waveFormData[i];
      }
      // this.analyserNode.getFloatTimeDomainData(this._waveFormData);
      this.analyserNode.getByteTimeDomainData(this._waveFormData);
      this.analyserNode.getFloatFrequencyData(this._frequencyData);
      for (i = 0; i < this._dataLen; i++) {
        value = this._waveFormData[i] / 256;
        x = i * (1920 / 1024);
        c = Math.cos(x * .05 - this._audioCtx.currentTime /* * avrgWaveForm * .0001*/) * 1;
        y = (this.cnv.height - (this.cnv.height * value * 50 ) - 1)  - this.cnv.height * .5;
      }
      this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);
      this._gl.uniform1f(this._pi.unifs.t, performance.now());
      let level = 0;
      let internalFormat = this._gl.LUMINANCE;
      let width = 2048;
      let height = 1;
      let border = 0;
      let srcFormat = this._gl.LUMINANCE;
      let srcType = this._gl.UNSIGNED_BYTE;
      if (!this._testImg || !this._testImg.complete) {return;}
      // this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, this._indexBuf);
      // this._gl.bindTexture(this._gl.TEXTURE_2D, this._tex);
      // this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
      // this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
      // this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
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
        this._waveFormData
        // new Uint8Array([0,0,255,255,0,255,0,255])
      );

      // this._gl.bindBuffer(this._gl.ARRAY_BUFFER, this._texBuf);
      // this._gl.vertexAttribPointer(this._pi.attrs.aTextureCoord, 2, this._gl.FLOAT, false, 0, 0);
      // this._gl.enableVertexAttribArray(this._pi.attrs.aTextureCoord);

      this._gl.activeTexture(this._gl.TEXTURE0);
      this._gl.uniform1i(this._pi.unifs.uSampler, 0);
      this._gl.drawElements(this._gl.TRIANGLES, 6, this._gl.UNSIGNED_SHORT, 0);
      // this._gl.drawArrays(this._gl.TRIANGLES, 0, 4);
    }
  }

  return new MainModule();
})();


window.onload = function () {
  mainModule.init();
};
