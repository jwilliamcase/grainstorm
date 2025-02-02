document.addEventListener('DOMContentLoaded', () => {
    const waveformCanvas = document.getElementById('waveform-canvas');
    const canvasCtx = waveformCanvas.getContext('2d');

    let audioContext; // Declare audioContext, but initialize later on user interaction
    // initializeAudioNodes(); // Initialize audio nodes will be done on first click



    const grainSizeControl = document.getElementById('grain-size');
    const grainRateControl = document.getElementById('grain-rate');
    const pitchControl = document.getElementById('pitch');
    const randomPositionControl = document.getElementById('random-position');
    const windowFunctionControl = document.getElementById('window-function');
    const playbackModeControl = document.getElementById('playback-mode');
    const sprayControl = document.getElementById('spray');
    const stopButton = document.getElementById('stop-button');
    const delayTimeControl = document.getElementById('delay-time');
    const delayFeedbackControl = document.getElementById('delay-feedback');
    const filterCutoffControl = document.getElementById('filter-cutoff');
    const filterCutoffValueDisplay = document.getElementById('filter-cutoff-value');
    const filterResonanceControl = document.getElementById('filter-resonance');
    const filterResonanceValueDisplay = document.getElementById('filter-resonance-value');
    const tempoControl = document.getElementById('tempo');
    const tempoValueDisplay = document.getElementById('tempo-value');
    const runButton = document.getElementById('run-button');
    const seqStopButton = document.getElementById('seq-stop-button');
    const stepElements = document.querySelectorAll('.step');


    const grainSizeValueDisplay = document.getElementById('grain-size-value');
    const grainRateValueDisplay = document.getElementById('grain-rate-value');
    const pitchValueDisplay = document.getElementById('pitch-value');
    const randomPositionValueDisplay = document.getElementById('random-position-value');
    const sprayValueDisplay = document.getElementById('spray-value');
    const delayTimeValueDisplay = document.getElementById('delay-time-value');
    const delayFeedbackValueDisplay = document.getElementById('delay-feedback-value');


    
    let audioBuffer;
    let globalFilterNode;
    let activeFilterNodes = [];
    let isGrainStreamActive = false;
    let grainIntervalId;
    let delayNodeLeft;
    let delayNodeRight;
    let feedbackGainNodeLeft;
    let feedbackGainNodeRight;
    let stereoPannerNode;
    let currentGrainPositionRatio = 0;

    // Sequencer Variables
    let sequencerIntervalId;
    let sequencerActive = false;
    let currentStep = 0; // Start at step 0 (index for array)
    const numSteps = 8;
    let sequencerStates = Array(numSteps).fill(null).map(() => ({ // Initialize sequencer states
        pitch: 0,
        grainSize: 50,
        randomPosition: 0,
        spray: 0
    }));


    // --- Initialize Audio Nodes ---
    function initializeAudioNodes() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Ping-Pong Delay Nodes
        delayNodeLeft = audioContext.createDelay(0.5);
        delayNodeLeft.delayTime.value = parseFloat(delayTimeControl.value);
        delayNodeRight = audioContext.createDelay(0.5);
        delayNodeRight.delayTime.value = parseFloat(delayTimeControl.value);

        feedbackGainNodeLeft = audioContext.createGain();
        feedbackGainNodeLeft.gain.value = parseFloat(delayFeedbackControl.value);
        feedbackGainNodeRight = audioContext.createGain();
        feedbackGainNodeRight.gain.value = parseFloat(delayFeedbackControl.value);

        stereoPannerNode = audioContext.createStereoPanner();
        
        // Create a global filter node for the wet signal path
        globalFilterNode = audioContext.createBiquadFilter();
        globalFilterNode.type = 'bandpass';
        globalFilterNode.frequency.value = parseFloat(filterCutoffControl.value);
        globalFilterNode.Q.value = parseFloat(filterResonanceControl.value);

        // Connect Delay Nodes in Ping-Pong Configuration
        delayNodeLeft.connect(feedbackGainNodeLeft);
        feedbackGainNodeLeft.connect(delayNodeRight);
        delayNodeRight.connect(feedbackGainNodeRight);
        feedbackGainNodeRight.connect(delayNodeLeft);

        // Connect Delay output to panner and then to destination
        delayNodeLeft.connect(stereoPannerNode);
        delayNodeRight.connect(stereoPannerNode);
        stereoPannerNode.connect(audioContext.destination);
    }


    // --- Update Control Value Displays & Parameter Updates ---
    grainSizeControl.addEventListener('input', () => {
        grainSizeValueDisplay.textContent = grainSizeControl.value + "ms";
        if (!sequencerActive) sequencerStates[currentStep].grainSize = parseInt(grainSizeControl.value);
    });
    grainRateControl.addEventListener('input', () => {
        grainRateValueDisplay.textContent = grainRateControl.value + " grains/sec";
    });
    pitchControl.addEventListener('input', () => {
        pitchValueDisplay.textContent = pitchControl.value + " st";
        if (!sequencerActive) sequencerStates[currentStep].pitch = parseInt(pitchControl.value);
    });
    randomPositionControl.addEventListener('input', () => {
        randomPositionValueDisplay.textContent = parseFloat(randomPositionControl.value).toFixed(2);
        if (!sequencerActive) sequencerStates[currentStep].randomPosition = parseFloat(randomPositionControl.value);
    });
    sprayControl.addEventListener('input', () => {
        sprayValueDisplay.textContent = parseFloat(sprayControl.value).toFixed(2);
        if (!sequencerActive) sequencerStates[currentStep].spray = parseFloat(sprayControl.value);
    });
    delayTimeControl.addEventListener('input', () => {
        const newDelay = parseFloat(delayTimeControl.value);
        delayTimeValueDisplay.textContent = newDelay.toFixed(2) + "s";
        if (delayNodeLeft && delayNodeRight && audioContext) {
            delayNodeLeft.delayTime.setTargetAtTime(newDelay, audioContext.currentTime, 0.1);
            delayNodeRight.delayTime.setTargetAtTime(newDelay, audioContext.currentTime, 0.1);
        }
    });
    delayFeedbackControl.addEventListener('input', () => {
        delayFeedbackValueDisplay.textContent = parseFloat(delayFeedbackControl.value).toFixed(2);
        if (feedbackGainNodeLeft && feedbackGainNodeRight) {
            feedbackGainNodeLeft.gain.value = parseFloat(delayFeedbackControl.value);
            feedbackGainNodeRight.gain.value = parseFloat(delayFeedbackControl.value);
        }
    });
    filterCutoffControl.addEventListener('input', () => {
        filterCutoffValueDisplay.textContent = filterCutoffControl.value + " Hz";
        const newVal = parseFloat(filterCutoffControl.value);
        if (globalFilterNode && audioContext) {
            globalFilterNode.frequency.setTargetAtTime(newVal, audioContext.currentTime, 0.1);
        }
    });
    filterResonanceControl.addEventListener('input', () => {
        filterResonanceValueDisplay.textContent = parseFloat(filterResonanceControl.value).toFixed(2);
        const newVal = parseFloat(filterResonanceControl.value);
        if (globalFilterNode && audioContext) {
            globalFilterNode.Q.setTargetAtTime(newVal, audioContext.currentTime, 0.1);
        }
    });

    
    tempoControl.addEventListener('input', () => {
        tempoValueDisplay.textContent = tempoControl.value + " BPM";
        if (sequencerActive) {
            clearInterval(sequencerIntervalId);
            sequencerIntervalId = setInterval(advanceSequencer, 60000 / tempoControl.value); // Reset tempo if sequencer active
        }
    });


    // --- Drag and Drop Handling ---
    waveformCanvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        waveformCanvas.classList.add('drag-over');
    });

    waveformCanvas.addEventListener('dragleave', () => {
        waveformCanvas.classList.remove('drag-over');
    });

    waveformCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        waveformCanvas.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            loadAudioFile(file);
        } else {
            alert('Please drop an audio file.');
        }
    });


    // --- Load Audio File Function ---
    function loadAudioFile(file) {
        const fileReader = new FileReader();
        fileReader.onload = async (event) => {
            try {
                if (!audioContext) {
                    initializeAudioNodes();
                }
                audioBuffer = await audioContext.decodeAudioData(event.target.result);
                drawWaveform(audioBuffer);
                waveformCanvas.classList.add('has-sample');
                isGrainStreamActive = false;
                stopGrainStream();
                stopSequencer();
            } catch (error) {
                console.error('Error decoding audio data:', error);
                alert('Error loading audio file.');
            }
        };
        fileReader.readAsArrayBuffer(file);
    }


    // --- Draw Waveform Function ---
    function drawWaveform(buffer, markerX) {
        const canvasWidth = waveformCanvas.width = waveformCanvas.offsetWidth;
        const canvasHeight = waveformCanvas.height = 150;
        canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear canvas FIRST

        if (!buffer) {
            canvasCtx.fillStyle = '#888';
            canvasCtx.font = '16px sans-serif';
            canvasCtx.textAlign = 'center';
            canvasCtx.textBaseline = 'middle';
            canvasCtx.fillText('Drag and drop audio sample here', canvasWidth / 2, canvasHeight / 2);
            waveformCanvas.classList.remove('has-sample');
            return;
        }


        const channelData = buffer.getChannelData(0);
        const waveformColor = '#FFFFFF'; // Use white for waveform


        canvasCtx.strokeStyle = waveformColor;
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();

        const samplesPerPixel = Math.ceil(channelData.length / canvasWidth);
        const scale = canvasHeight / 2;

        for (let x = 0; x < canvasWidth; x++) {
            let min = 1.0;
            let max = -1.0;
            for (let i = 0; i < samplesPerPixel; i++) {
                const sampleIndex = (x * samplesPerPixel) + i;
                if (sampleIndex < channelData.length) {
                    const sample = channelData[sampleIndex];
                    min = Math.min(min, sample);
                    max = Math.max(max, sample);
                }
            }
            const yMin = (1 - max) * scale;
            const yMax = (1 - min) * scale;

            canvasCtx.moveTo(x, yMin);
            canvasCtx.lineTo(x, yMax);
        }

        canvasCtx.stroke();
    
        // Draw marker if provided
        if (typeof markerX !== 'undefined') {
            canvasCtx.strokeStyle = '#FF0000'; // Red marker line
            canvasCtx.lineWidth = 2;
            canvasCtx.beginPath();
            canvasCtx.moveTo(markerX, 0);
            canvasCtx.lineTo(markerX, canvasHeight);
            canvasCtx.stroke();
        }
    }


    // --- Mouse Interaction for Grain Stream (Click to Start/Move) ---
    waveformCanvas.addEventListener('click', (e) => {
        if (!audioBuffer) return;

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Initialize AudioContext on first click
            initializeAudioNodes(); // Initialize audio nodes now that context exists
        }

        const canvasRect = waveformCanvas.getBoundingClientRect();
        const clickX = e.clientX - canvasRect.left;
        currentGrainPositionRatio = clickX / waveformCanvas.width;
        // Redraw waveform with a marker at the click position
        drawWaveform(audioBuffer, clickX);
    
        if (!isGrainStreamActive && !sequencerActive) {
            isGrainStreamActive = true;
            startGrainStream();
        }
    });


    // --- Stop Button ---
    stopButton.addEventListener('click', () => {
        isGrainStreamActive = false;
        stopGrainStream();
    });


    // --- Grain Stream Functions ---
    function startGrainStream() {
        stopGrainStream();
        grainIntervalId = setInterval(() => {
            if (isGrainStreamActive) {
                playGrainAtCurrentPosition();
            }
        }, calculateGrainInterval());
    }


    function stopGrainStream() {
        clearInterval(grainIntervalId);
    }


    function calculateGrainInterval() {
        let baseInterval = 1000 / grainRateControl.value;
        let sprayAmount = parseFloat(sprayControl.value);
        let randomFactor = (Math.random() * sprayAmount * baseInterval);
        return baseInterval + randomFactor;
    }


    function playGrainAtCurrentPosition() {
        if (!audioContext || !audioBuffer) return;


        const positionRatio = currentGrainPositionRatio;
        const grainDurationMs = parseInt(grainSizeControl.value, 10);
        const grainDuration = grainDurationMs / 1000;
        const grainStartPositionRatio = positionRatio;
        const pitchShift = parseInt(pitchControl.value, 10);
        const positionRandomness = parseFloat(randomPositionControl.value);
        const windowType = windowFunctionControl.value;
        const playbackMode = playbackModeControl.value;


        let grainStartPosition = audioBuffer.duration * grainStartPositionRatio;
        const randomOffset = (Math.random() - 0.5) * positionRandomness * audioBuffer.duration;
        grainStartPosition = Math.max(0, Math.min(audioBuffer.duration - grainDuration, grainStartPosition + randomOffset));


        let grainBuffer;
        let bufferLength = Math.ceil(audioContext.sampleRate * grainDuration);
        let startSample = Math.floor(grainStartPosition * audioContext.sampleRate);


        if (startSample < 0) startSample = 0;
        if (startSample + bufferLength > audioBuffer.length) {
            bufferLength = audioBuffer.length - startSample;
        }
        if (bufferLength < 0 ) bufferLength = 0;


        grainBuffer = audioBuffer.getChannelData(0).slice(startSample, startSample + bufferLength);


        if (playbackMode === 'reverse') {
            grainBuffer.reverse();
        } else if (playbackMode === 'random') {
            // No special playback for random mode
        }


        const sourceBuffer = audioContext.createBuffer(1, grainBuffer.length, audioContext.sampleRate);
        sourceBuffer.copyToChannel(grainBuffer, 0);


        const source = audioContext.createBufferSource();
        source.buffer = sourceBuffer;
        // --- Grain Envelope (Smoother Hann Window) ---
        const gainNode = audioContext.createGain();
        applyWindowFunction(gainNode, grainDuration, windowType);
        source.connect(gainNode);
        
        // Create dry path for immediate signal routing
        const dryGain = audioContext.createGain();
        dryGain.gain.value = 1.0; // Full level dry signal
        gainNode.connect(dryGain);
        dryGain.connect(stereoPannerNode);
        
        // Route wet path through the global filter and then into the delay chain
        gainNode.connect(globalFilterNode);
        globalFilterNode.connect(delayNodeLeft);
        
        // --- Stereo Panning ---
        stereoPannerNode.pan.value = (Math.random() * 2) - 1;
        if (pitchShift !== 0) {
            source.playbackRate.value = Math.pow(2, pitchShift / 12);
        }





        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        source.start(audioContext.currentTime);
        waveformCanvas.classList.add('grain-play');
        setTimeout(() => {
            waveformCanvas.classList.remove('grain-play');
        }, 100);
        source.stop(audioContext.currentTime + grainDuration);
    }


    function applyWindowFunction(gainNode, duration, windowType) {
        if (isNaN(duration) || duration <= 0) {
            console.error("Invalid duration for window function:", duration);
            return;
        }
        const bufferSize = Math.ceil(audioContext.sampleRate * duration);
        const windowValues = new Float32Array(bufferSize);


        for (let i = 0; i < bufferSize; i++) {
            let windowValue = 1.0;

            if (windowType === 'hann') {
                windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (bufferSize - 1)));
            } else if (windowType === 'hamming') {
                windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (bufferSize - 1));
            }

            windowValues[i] = windowValue * 0.8;
        }


        if (windowType === 'rectangular') {
            gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        } else {
            gainNode.gain.setValueCurveAtTime(windowValues, audioContext.currentTime, duration);
        }
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration); // Release
    }



    // --- Sequencer Functions ---
    runButton.addEventListener('click', startSequencer);
    seqStopButton.addEventListener('click', stopSequencer);
    stepElements.forEach((step, index) => {
        step.addEventListener('click', () => {
            currentStep = index;
            updateStepHighlight();
            applySequencerStep(currentStep);
        });
    });

    // --- Randomize Buttons ---
    const randomizeAllButton = document.getElementById('randomize-all');
    const randomizeSeqButton = document.getElementById('randomize-sequencer');

    randomizeAllButton.addEventListener('click', randomizeAllParameters);
    randomizeSeqButton.addEventListener('click', randomizeSequencerParametersForAllSteps); // Changed to randomize all steps


    function randomizeAllParameters() {
        grainSizeControl.value = Math.random() * (200 - 10) + 10;
        grainRateControl.value = Math.random() * (100 - 10) + 10;
        pitchControl.value = Math.floor(Math.random() * (12 - (-12) + 1)) - 12;
        randomPositionControl.value = Math.random();
        sprayControl.value = Math.random();
        delayTimeControl.value = Math.random() * 0.5 + 0.01;
        delayFeedbackControl.value = Math.random() * 0.9;
        windowFunctionControl.value = ['hann', 'hamming', 'rectangular'][Math.floor(Math.random() * 3)];
        playbackModeControl.value = ['forward', 'reverse', 'random'][Math.floor(Math.random() * 3)];

        // Update UI displays
        grainSizeValueDisplay.textContent = grainSizeControl.value + "ms";
        grainRateValueDisplay.textContent = grainRateControl.value + " grains/sec";
        pitchValueDisplay.textContent = pitchControl.value + " st";
        randomPositionValueDisplay.textContent = parseFloat(randomPositionControl.value).toFixed(2);
        sprayValueDisplay.textContent = parseFloat(sprayControl.value).toFixed(2);
        delayTimeValueDisplay.textContent = parseFloat(delayTimeControl.value).toFixed(2) + "s";
        delayFeedbackValueDisplay.textContent = parseFloat(delayFeedbackControl.value).toFixed(2);

        if (!sequencerActive) {
            sequencerStates[currentStep].grainSize = parseInt(grainSizeControl.value);
            sequencerStates[currentStep].pitch = parseInt(pitchControl.value);
            sequencerStates[currentStep].randomPosition = parseFloat(randomPositionControl.value);
            sequencerStates[currentStep].spray = parseFloat(sprayControl.value);
        }
    }


    function randomizeSequencerStepParameters(stepIndex) { // Now takes stepIndex as argument
        sequencerStates[stepIndex] = { // Apply to specific step
            pitch: Math.floor(Math.random() * (12 - (-12) + 1)) - 12,
            grainSize: Math.random() * (200 - 10) + 10,
            randomPosition: Math.random(),
            spray: Math.random()
        };
    }

    function randomizeSequencerParametersForAllSteps() {
        for (let i = 0; i < numSteps; i++) {
            randomizeSequencerStepParameters(i); // Randomize each step
        }
         applySequencerStep(currentStep); // Update UI to reflect current step parameters after randomizing all
    }


    function startSequencer() {
        if (sequencerActive) return;

        sequencerActive = true;
        currentStep = 0;
        updateStepHighlight();
        applySequencerStep(currentStep);
        sequencerIntervalId = setInterval(advanceSequencer, 60000 / tempoControl.value);
    }


    function stopSequencer() {
        sequencerActive = false;
        clearInterval(sequencerIntervalId);
        resetStepHighlight();
    }


    function advanceSequencer() {
        currentStep = (currentStep + 1) % numSteps;
        updateStepHighlight();
        applySequencerStep(currentStep);
    }


    function applySequencerStep(stepIndex) {
        const stepState = sequencerStates[stepIndex];
        if (!stepState) return;

        // Update UI controls to reflect sequencer state - and set values to the controls themselves
        pitchControl.value = stepState.pitch;
        pitchValueDisplay.textContent = stepState.pitch + " st";
        grainSizeControl.value = stepState.grainSize;
        grainSizeValueDisplay.textContent = stepState.grainSize + "ms";
        randomPositionControl.value = stepState.randomPosition;
        randomPositionValueDisplay.textContent = stepState.randomPosition.toFixed(2);
        sprayControl.value = stepState.spray;
        sprayValueDisplay.textContent = stepState.spray.toFixed(2);
    }


    function updateStepHighlight() {
        stepElements.forEach((step, index) => {
            step.classList.toggle('active', index === currentStep);
        });
    }

    function resetStepHighlight() {
        stepElements.forEach((step, index) => {
            step.classList.remove('active');
        });
    }


    // --- Load default sample on startup ---
    async function loadDefaultSample() {
        try {
            const response = await fetch('assets/default.wav');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            if (!audioContext) { // Initialize audio context if it's not already there (in case default load happens before click)
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                initializeAudioNodes();
            }
            audioContext.decodeAudioData(arrayBuffer).then(decodedBuffer => {
                audioBuffer = decodedBuffer;
                drawWaveform(audioBuffer);
                waveformCanvas.classList.add('has-sample');
                console.log('Default sample loaded successfully');
            }).catch(decodeError => {
                console.error('Error decoding default audio data:', decodeError);
            });
        } catch (error) {
            console.error('Error loading default sample:', error);
        }
    }


    drawWaveform(null); // Initial draw placeholder text
    loadDefaultSample(); // Attempt to load default sample on startup
    applySequencerStep(0); // Initialize UI with first step parameters

    window.addEventListener('resize', () => {
        if (audioBuffer) {
            drawWaveform(audioBuffer);
        }
    });
});