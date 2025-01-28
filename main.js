// Initialize audio context and nodes
let audioContext, grainstormNode;

async function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  try {
    // Load sample
    const response = await fetch('assets/default.wav');
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Load processor
    await audioContext.audioWorklet.addModule('grainstormProcessor.js');
    grainstormNode = new AudioWorkletNode(audioContext, 'grainstorm-processor');

    // Send sample data
    const sampleData = audioBuffer.getChannelData(0);
    grainstormNode.port.postMessage({ command: 'loadSample', samples: sampleData });

    // Enable controls
    document.getElementById('togglePlayback').disabled = false;
    document.getElementById('grainSizeSlider').disabled = false;
    
    // Connect Grain Size slider
    const grainSizeParam = grainstormNode.parameters.get('grainSize');
    document.getElementById('grainSizeSlider').max = audioBuffer.duration;
    document.getElementById('grainSizeSlider').addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      grainSizeParam.value = value;
      document.getElementById('grainSizeValue').innerText = value.toFixed(2);
    });

    // Connect Pitch slider
    const pitchParam = grainstormNode.parameters.get('pitch');
    document.getElementById('pitchSlider').addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      pitchParam.value = value;
      document.getElementById('pitchValue').innerText = value.toFixed(2);
    });
    
  } catch (error) {
    console.error('Audio initialization failed:', error);
  }
}

// Playback state
let isPlaying = false;
function togglePlayback() {
  if (!grainstormNode) {
    return;
  }

  if (isPlaying) {
    grainstormNode.disconnect(audioContext.destination);
    isPlaying = false;
  } else {
    grainstormNode.connect(audioContext.destination);
    isPlaying = true;
  }
}

    window.togglePlayback = togglePlayback;

    // Initialize when module loads
    initAudio();