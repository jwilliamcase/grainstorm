/** grainstorm/grainstormProcessor.js */

/**
 * A minimal granular processor that loops through a loaded sample
 * at a variable pitch and grain size. Single-channel demonstration only.
 */
class GrainstormProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'grainSize',
        defaultValue: 1.0, // seconds
        minValue: 0.01,
        maxValue: 10.0
      },
      {
        name: 'pitch',
        defaultValue: 1.0,
        minValue: 0.5,
        maxValue: 2.0
      }
    ];
  }

  constructor(options) {
    super();
    // Sample data (single-channel). If using multi-channel, store arrays of Float32Arrays.
    this._sampleData = null;
    // Current playback position (in samples)
    this._position = 0;
    // Cache the sampleRate from AudioWorkletGlobalScope
    this._sampleRate = sampleRate;

    // Listen for messages from the main thread. One approach is to
    // receive an array of float data to set up the sample. This is optional
    // and may be replaced by a more advanced strategy.
    this.port.onmessage = (event) => {
      if (event.data.command === 'loadSample') {
        // Expecting a Float32Array or similar
        this._sampleData = event.data.samples;
        this._position = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output) return true;

    // For simplicity, assume we just use the first output channel.
    // You can adapt for multiple output channels by iterating over channels.
    const outChannel = output[0];

    // Extract parameter values (ignoring automation for brevity)
    const grainSizeArray = parameters.grainSize;
    const pitchArray = parameters.pitch;
    const grainSize = grainSizeArray.length > 0 ? grainSizeArray[0] : 0.1;
    const pitch = pitchArray.length > 0 ? pitchArray[0] : 1.0;

    // If no sample loaded, output silence
    if (!this._sampleData) {
      for (let i = 0; i < outChannel.length; i++) {
        outChannel[i] = 0;
      }
      return true;
    }

    // Calculate how many samples the current grain should be
    const grainLengthInSamples = grainSize * this._sampleRate;
    const sampleDataLength = this._sampleData.length;

    // Fill each sample in this block
    for (let i = 0; i < outChannel.length; i++) {
      // Read from sample data
      const sampleIndex = Math.floor(this._position);
      let sampleValue = 0;

      if (sampleIndex >= 0 && sampleIndex < sampleDataLength) {
        sampleValue = this._sampleData[sampleIndex];
      }

      outChannel[i] = sampleValue;

      // Advance position by pitch
      this._position += pitch;

      // If we've reached the end of the grain size window, wrap
      if (this._position >= grainLengthInSamples) {
        this._position = 0;
      }
    }
    return true; // Keep processor active
  }
}

// Register the processor under a specific name that main.js uses
registerProcessor('grainstorm-processor', GrainstormProcessor);