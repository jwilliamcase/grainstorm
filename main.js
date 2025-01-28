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
    const pitchSlider = document.getElementById('pitchSlider');
    const pitchValueSpan = document.getElementById('pitchValue');
    const pitchModeSelect = document.getElementById('pitchMode');
    const pitchModeValueSpan = document.getElementById('pitchModeValue');
    
    // Define pitch steps for different modes
    const pitchModes = {
      '12-tone': [0.5, 0.53, 0.56, 0.59, 0.63, 0.67, 0.71, 0.75, 0.8, 0.84, 0.89, 0.94, 1.0, 1.06, 1.12, 1.19, 1.26, 1.34, 1.42, 1.5, 1.59, 1.69, 1.79, 1.89, 2.0],
      'major': [0.5, 0.56, 0.63, 0.71, 0.8, 0.89, 1.0, 1.12, 1.26, 1.42, 1.59, 1.79, 2.0],
      'minor': [0.5, 0.56, 0.63, 0.71, 0.79, 0.89, 1.0, 1.12, 1.26, 1.42, 1.59, 1.78, 2.0]
    };
    
    let currentPitchMode = 'smooth';
    
    // Helper function to find the closest step
    function findClosestStep(value, steps) {
      let closest = steps[0];
      let minDiff = Math.abs(value - closest);
      for (let i = 1; i < steps.length; i++) {
        const diff = Math.abs(value - steps[i]);
        if (diff < minDiff) {
          closest = steps[i];
          minDiff = diff;
        }
      }
      return closest;
    }
    
    // Event listener for Pitch Mode selection
    pitchModeSelect.addEventListener('change', (e) => {
      currentPitchMode = e.target.value;
      pitchModeValueSpan.innerText = capitalizeFirstLetter(currentPitchMode.replace('-', ' '));
      // Reset pitch slider to default value
      pitchSlider.value = 1.0;
      pitchParam.value = 1.0;
      pitchValueSpan.innerText = pitchParam.value.toFixed(2);
    });
    
    // Event listener for Pitch slider
    pitchSlider.addEventListener('input', (e) => {
      let value = parseFloat(e.target.value);
      if (currentPitchMode !== 'smooth') {
        const steps = pitchModes[currentPitchMode];
        value = findClosestStep(value, steps);
        pitchSlider.value = value;
      }
      pitchParam.value = value;
      pitchValueSpan.innerText = value.toFixed(2);
    });
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
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