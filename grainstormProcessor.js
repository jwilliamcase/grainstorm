/** grainstorm/grainstormProcessor.js */

class GrainstormProcessor extends AudioWorkletProcessor {
              static get parameterDescriptors() {
                            return [
                                          { name: 'grainSize', defaultValue: 0.1, minValue: 0.01, maxValue: 2.0 },
                                          { name: 'pitch', defaultValue: 1.0, minValue: 0.25, maxValue: 4.0 },
                                          { name: 'density', defaultValue: 20.0, minValue: 1.0, maxValue: 100.0 },
                                          { name: 'spray', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
                                          { name: 'windowType', defaultValue: 0, minValue: 0, maxValue: 2 }
                            ];
              }

              constructor() {
                            super();
                            this._sampleData = null;
                            this._writePos = 0; // Position through sample buffer
                            this._sampleRate = sampleRate;
                            this.phase = 0;
                            this.grains = [];
                            this._lastGrainTime = 0;

                            this.port.onmessage = (event) => {
                                          if (event.data.command === 'loadSample') {
                                                        this._sampleData = event.data.samples;
                                                        this._position = 0;
                                          }
                            };
              }

              process(inputs, outputs, parameters) {
                            if (!this._sampleData) return true;
                            const output = outputs[0][0];
                            const now = currentTime;
                            
                            // Get current parameters
                            const grainSizeSec = parameters.grainSize[0];
                            const pitch = parameters.pitch[0];
                            const density = parameters.density[0];
                            const spray = parameters.spray[0];
                            const grainSizeSamples = Math.floor(grainSizeSec * this._sampleRate);

                            // Advance write position through sample buffer
                            this._writePos += output.length;
                            if (this._writePos > this._sampleData.length) {
                                          this._writePos %= this._sampleData.length;
                            }

                            // Schedule new grains based on density
                            const timeBetweenGrains = 1 / density;
                            while (now - this._lastGrainTime > timeBetweenGrains) {
                                          const sprayOffset = Math.floor(spray * grainSizeSamples * (Math.random() - 0.5));
                                          this.grains.push({
                                                        startTime: this._lastGrainTime,
                                                        position: (this._writePos + sprayOffset + this._sampleData.length) % this._sampleData.length,
                                                        age: 0,
                                                        duration: grainSizeSec,
                                                        window: this._createWindow(grainSizeSamples, parameters.windowType[0])
                                          });
                                          this._lastGrainTime += timeBetweenGrains;
                            }

                            // Process audio block
                            for (let i = 0; i < output.length; i++) {
                                          output[i] = 0;
                                          const t = now + i / this._sampleRate;

                                          // Accumulate active grains
                                          for (let g = this.grains.length - 1; g >= 0; g--) {
                                                        const grain = this.grains[g];
                                                        const grainAge = t - grain.startTime;
                                                        
                                                        if (grainAge > grain.duration) {
                                                                      this.grains.splice(g, 1);
                                                                      continue;
                                                        }

                                                        // Calculate window position
                                                        const windowPos = Math.floor(grainAge * this._sampleRate);
                                                        if (windowPos >= grain.window.length) continue;

                                                        // Calculate sample position with pitch
                                                        const samplePos = (grain.position + Math.floor(grainAge * pitch * this._sampleRate))
                                                                                                                                                                                      % this._sampleData.length;

                                                        // Apply window and mix
                                                        output[i] += this._sampleData[samplePos] * grain.window[windowPos];
                                          }
                                          
                                          // Prevent clipping
                                          output[i] = Math.tanh(output[i]);
                            }

                            return true;
              }
              
              // Create window envelope with multiple shapes
              _createWindow(length, type) {
                            const window = new Float32Array(length);
                            
                            for (let i = 0; i < length; i++) {
                                          const phase = i / length;
                                          switch(Math.round(type)) {
                                                        case 1: // Triangle
                                                                      window[i] = 1 - Math.abs(2 * phase - 1);
                                                                      break;
                                                        case 2: // Hann
                                                                      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * phase));
                                                                      break;
                                                        default: // Original cosine (Hybrid)
                                                                      window[i] = Math.cos((phase - 0.5) * Math.PI) * 0.5 + 0.5;
                                          }
                            }
                            return window;
              }
}

registerProcessor('grainstorm-processor', GrainstormProcessor);