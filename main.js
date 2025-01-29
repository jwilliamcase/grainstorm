/** main.js */

let audioContext = null;
let grainstormNode = null;
let audioBuffer = null;

/**
 * Draw waveform from a given AudioBuffer onto the #waveformCanvas
 */
function drawWaveform(ab) {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) {
    console.warn("[main.js] No waveformCanvas found in DOM.");
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn("[main.js] Canvas context not available.");
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  // Clear
  ctx.clearRect(0, 0, width, height);

  if (!ab) {
    console.warn("[main.js] No audioBuffer for waveform drawing.");
    return;
  }

  // We'll use channel 0 for the wave
  const data = ab.getChannelData(0);
  if (!data || data.length === 0) {
    console.warn("[main.js] AudioBuffer channel0 is empty or missing.");
    return;
  }

  // Step is how many samples we skip each pixel
  const step = Math.ceil(data.length / width);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath();

  let x = 0;
  for (let i = 0; i < data.length; i += step) {
    const val = data[i] * 0.5; // amplitude scale
    const y = height / 2 - val * (height / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x++;
  }
  ctx.stroke();
}

// MAIN init
async function initAudio() {
  console.log("[main.js] Initializing audio...");

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    // Fetch sample
    const resp = await fetch('assets/default.wav');
    const arrBuf = await resp.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrBuf);

    // Load Worklet
    await audioContext.audioWorklet.addModule('grainstormProcessor.js');
    grainstormNode = new AudioWorkletNode(audioContext, 'grainstorm-processor');

    // Sample data
    const sampleData = [
      audioBuffer.getChannelData(0),
      audioBuffer.numberOfChannels > 1
        ? audioBuffer.getChannelData(1)
        : audioBuffer.getChannelData(0)
    ];
    console.log("[main.js] Sample loaded. Ch0[0..9]:", sampleData[0].slice(0,10));

    // Send sample
    grainstormNode.port.postMessage({
      command: 'loadSample',
      samples: sampleData
    });

    // Create Delay, feedback
    const delayNode = audioContext.createDelay(1.0);
    delayNode.delayTime.value = 0.4;

    const feedbackGain = audioContext.createGain();
    feedbackGain.gain.value = 0.3;

    // Connect
    grainstormNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(audioContext.destination);

    // Setup controls
    setupSliders(delayNode, feedbackGain);

    // Attempt to draw wave
    drawWaveform(audioBuffer);

    console.log("[main.js] Audio initialized successfully.");
  } catch (err) {
    console.error("[main.js] Audio initialization failed:", err);
  }
}

function setupSliders(delayNode, feedbackGain) {
  // Delay
  const delayTimeSlider = document.getElementById('delayTimeSlider');
  const delayTimeValueSpan = document.getElementById('delayTimeValue');
  if (delayTimeSlider && delayTimeValueSpan) {
    delayTimeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      delayNode.delayTime.value = val;
      delayTimeValueSpan.innerText = val.toFixed(2);
    });
  }

  // Feedback
  const feedbackSlider = document.getElementById('feedbackSlider');
  const feedbackValueSpan = document.getElementById('feedbackValue');
  if (feedbackSlider && feedbackValueSpan) {
    feedbackSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      feedbackGain.gain.value = val;
      feedbackValueSpan.innerText = val.toFixed(2);
    });
  }

  // Setup other param sliders here ...
  // ...
}

// Start on load
window.addEventListener('load', () => {
  initAudio();
});