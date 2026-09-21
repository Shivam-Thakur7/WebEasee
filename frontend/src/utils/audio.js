export async function convertWebmToWavBlob(webmBlob) {
  const arrayBuffer = await webmBlob.arrayBuffer();
  // Decode the webm audio via the browser's native AudioContext
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  return bufferToWav(audioBuffer);
}

function bufferToWav(abuffer) {
  let numOfChan = abuffer.numberOfChannels,
      length = abuffer.length * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length
  
  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));
  
  while(pos < length) {
    for(i = 0; i < numOfChan; i++) {
      // get sample, clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      // scale to 16-bit signed integer
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++; // next source sample
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
