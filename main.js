/**
 * Toggle playback for the grainstormNode by connecting or disconnecting
 * it from the audioContext destination. This is a simplistic approach
 * for start/stop.
 */
let isPlaying = false;
function togglePlayback() {
  if (!grainstormNode) return;

  if (isPlaying) {
    // Stop playback
  const response = await fetch('assets/default.aiff');
    isPlaying = false;
  } else {
    // Start playback
    grainstormNode.connect(audioContext.destination);
    isPlaying = true;
  }
}