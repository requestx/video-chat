
const videoElement = document.querySelector('#local');
const videoSelect = document.querySelector('select#videoSource');

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      /*
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
      */
    } else if (deviceInfo.kind === 'audiooutput') {
      /*
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
      */
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch((e)=>{
  console.log(a)
});
