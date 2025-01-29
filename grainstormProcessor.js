/** grainstorm/grainstormProcessor.js */

class GrainstormProcessor extends AudioWorkletProcessor {
    // Use a single output bus with two channels
    static get numberOfOutputs() { return 1; }
    static get outputChannelCount() { return [2]; }

    static get parameterDescriptors() {
        return [
            { name: 'maxGrains', defaultValue: 50, minValue: 3, maxValue: 200 }, // New safety valve
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
                // Force stereo buffer structure
                const input = event.data.samples;
                this._sampleData = Array.isArray(input[0])
                    ? [input[0], input[1] || input[0]] // Stereo or dual-mono
                    : [input, input]; // Mono -> stereo
                this._position = 0;
                console.log("[GrainstormProcessor] Sample loaded.");
                console.log("[GrainstormProcessor] Channel0 first few samples:", this._sampleData[0].slice(0, 10));
                console.log("[GrainstormProcessor] Channel1 first few samples:", this._sampleData[1].slice(0, 10));
            } else if (event.data.command === 'setGrainPosition') {
                // We'll store it and schedule a grain from that position
                this._clickedSamplePos = event.data.position;
                console.log(`[GrainstormProcessor] Received new grain position: ${this._clickedSamplePos}`);
            }
        };
    }

    process(inputs, outputs, parameters) {
        if (!this._sampleData) return true;
        const now = currentFrame / sampleRate;

        // We'll have one output bus => outputs[0], with 2 channels => outputs[0][0], outputs[0][1]
        const outputLeft = outputs[0][0];
        const outputRight = outputs[0][1];

        // Safety check
        if (!outputLeft || !outputRight) {
            return true;
        }
        const bufferLength = outputLeft.length;

        // Zya-style buffer clearing
        for (let i = 0; i < bufferLength; i++) {
            outputLeft[i] = 0;
            outputRight[i] = 0;
        }

        // 3. Get current parameters
        const grainSizeSec = parameters.grainSize[0];
        const pitch = parameters.pitch[0];
        const density = parameters.density[0];
        const spray = parameters.spray[0];
        const maxGrains = parameters.maxGrains[0];
        const grainSizeSamples = Math.floor(grainSizeSec * this._sampleRate);

        // Advance write position through sample buffer
        // (Removed duplicate declaration of bufferLength)
        this._writePos += bufferLength;
        if (this._writePos > this._sampleData[0].length) {
            this._writePos %= this._sampleData[0].length;
        }

        // ZYA-style grain scheduling with overlap
        const grainsPerSecond = density;
        const grainsToSchedule = Math.floor((now - this._lastGrainTime) * grainsPerSecond);

        const maxNewGrains = parameters.maxGrains[0] - this.grains.length;
        for (let i = 0; i < Math.min(grainsToSchedule, maxNewGrains); i++) {
            const sprayOffset = spray * this._sampleData[0].length * (Math.random() * 2 - 1);
            const grainDuration = grainSizeSec * (0.8 + Math.random() * 0.4);

            this.grains.push({
                startTime: this._lastGrainTime + (i / grainsPerSecond),
                position: (this._writePos + sprayOffset + this._sampleData.length) % this._sampleData.length,
                age: 0,
                duration: grainDuration,
                window: this._createWindow(Math.floor(grainDuration * this._sampleRate)),
                pan: Math.random() * 2 - 1
            });
        }
        this._lastGrainTime += grainsToSchedule / grainsPerSecond;

        // Process audio block
        for (let i = 0; i < outputs[0][0].length; i++) {
            outputs[0][0][i] = 0;
            outputs[0][1][i] = 0;
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

                // Zya-style position calculation with fractional sampling
                const samplePos = (grain.position + grainAge * pitch * this._sampleRate);
                const sampleIndex = Math.floor(samplePos) % this._sampleData[0].length;
                const frac = samplePos - Math.floor(samplePos);

                // Linear interpolation
                const nextIndex = (sampleIndex + 1) % this._sampleData[0].length;
                const sample = this._sampleData[0][sampleIndex] * (1 - frac) +
                    this._sampleData[0][nextIndex] * frac;

                // ZYA-style stereo processing
                const leftGain = 0.5 * (1 - grain.pan);
                const rightGain = 0.5 * (1 + grain.pan);

                outputs[0][0][i] += this._sampleData[0][samplePos] * grain.window[windowPos] * leftGain;
                outputs[0][1][i] += this._sampleData[1][samplePos] * grain.window[windowPos] * rightGain;
            }

            // Prevent clipping


            // Gentle feedback
            // outputs[0][0][i] += outputs[0][0][i] * 0.2;
            // outputs[0][1][i] += outputs[0][1][i] * 0.2;

            // Soft clipping
            // outputs[0][0][i] = Math.tanh(outputs[0][0][i]);
            // outputs[0][1][i] = Math.tanh(outputs[0][1][i]);
        }

        return true;
    }

    // Create window envelope with multiple shapes
    _createWindow(length) {
        const type = this.parameters.windowType[0];
        const window = new Float32Array(length);
        //fill in the code here
        return window;
    }
}

registerProcessor('grainstorm-processor', GrainstormProcessor);