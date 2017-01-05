/**


/************************************************************************
* Control a NeoPixel LED unit and servo motor connected to a Raspberry Pi pin through voice commands
* Must run with root-level protection
* sudo node wave.js


Follow the instructions in XXX to
get the system ready to run this code.
*/

/************************************************************************
* Step #1: Configuring your Bluemix Credentials
************************************************************************
In this step, the audio sample (pipe) is sent to "Watson Speech to Text" to transcribe.
The service converts the audio to text and saves the returned text in "textStream"
*/
var pigpio = require('pigpio')
pigpio.initialize();


var watson = require('watson-developer-cloud');
var config = require('./config');  // gets our username and passwords from the config.js files
var speech_to_text = watson.speech_to_text({
  username: config.STTUsername,
  password: config.STTPassword,
  version: config.version,
  customization_id: config.STTCustomizationid,
});

var fs = require('fs');
var exec = require('child_process').exec;

var conversation = watson.conversation({
  username: config.ConUsername,
  password: config.ConPassword,
  version: 'v1',
  version_date: '2016-07-11'
});

var text_to_speech = watson.text_to_speech({
  username: config.TTSUsername,
  password: config.TTSPassword,
  version: 'v1'
});

var AudioContext = require('web-audio-api').AudioContext
context = new AudioContext
var _ = require('underscore');



/************************************************************************
* Step #2: Configuring the Microphone
************************************************************************
In this step, we configure your microphone to collect the audio samples as you talk.
See https://www.npmjs.com/package/mic for more information on
microphone input events e.g on error, startcomplete, pause, stopcomplete etc.
*/

// Initiate Microphone Instance to Get audio samples
var mic = require('mic');
var micInstance = mic({ 'rate': '44100', 'channels': '2', 'debug': false, 'exitOnSilence': 6 });
var micInputStream = micInstance.getAudioStream();

micInputStream.on('data', function(data) {
  //console.log("Recieved Input Stream: " + data.length);
});

micInputStream.on('error', function(err) {
  console.log("Error in Input Stream: " + err);
});

micInputStream.on('silence', function() {
  // detect silence.
});
micInstance.start();
console.log("TJ is listening, you may speak now.");

/************************************************************************
* Step #3: Converting your Speech Commands to Text
************************************************************************
In this step, the audio sample is sent (piped) to "Watson Speech to Text" to transcribe.
The service converts the audio to text and saves the returned text in "textStream"
*/

var recognizeparams = {
  content_type: 'audio/l16; rate=44100; channels=2',
  interim_results: true,
  smart_formatting: true
  //  model: 'en-US_BroadbandModel'  // Specify your language model here
};


textStream = micInputStream.pipe(speech_to_text.createRecognizeStream(recognizeparams));

textStream.setEncoding('utf8');

/*********************************************************************
* Step #4: Parsing the Text
*********************************************************************
In this step, we parse the text to look for commands such as "ON" or "OFF".
You can say any variations of "lights on", "turn the lights on", "turn on the lights", etc.
You would be able to create your own customized command, such as "good night" to turn the lights off.
What you need to do is to go to parseText function and modify the text.
*/

textStream.setEncoding('utf8');

/*********************************************************************
* Step #4: Parsing the Text and create a response
*********************************************************************
In this step, we parse the text to look for attention word and send that sentence
to watson conversation to get appropriate response. You can change it to something else if needed.
Once the attention word is detected,the text is sent to Watson conversation for processing. The response is generated by Watson Conversation and is sent back to the module.
*/
var conversationcontext = {} ; // Save information on conversation context/stage for continous conversation
textStream.setEncoding('utf8');
textStream.on('data', function(str) {
  console.log(' ===== Speech to Text ===== : ' + str); // print the text once received

  var res = str ;
  console.log("msg sent to conversation:" ,res);
  conversation.message({
    workspace_id: config.ConWorkspace,
    input: {'text': res},
    context: conversationcontext
  },  function(err, response) {
    if (err) {
      console.log('error:', err);
    } else {
      conversationcontext = response.context ; //update conversation context
      conversation_response =  response.output.text[0]  ;
      if (conversation_response != undefined ){
        var params = {
          text: response.output.text[0],
          voice: config.voice,
          accept: 'audio/wav'
        };

        console.log("Result from conversation : " , conversation_response);
        var matchedintent =  response.intents[0].intent ; // intent with the highest confidence
        var intentconfidence = response.intents[0].confidence  ;
        console.log("intents : " , response.intents) ;

        if (intentconfidence > 0.5){
          setLEDColor("green", Math.floor(intentconfidence * 255) ) ;
          if(matchedintent == "dance"){
            speak(conversation_response) ;
            dance();
          }else if(matchedintent == "wave"){
            speak(conversation_response) ;
            waveArm("wave") ;
          } else if(matchedintent == "see"){
            launchVision();
          }else if(matchedintent == "off_topic"){
            //launchVision();
          } else {
            speak(conversation_response) ;
          }

        }else{
          setLEDColor("red", Math.floor(255) ) ;
        }


        /*********************************************************************
        Step #5: Speak out the response
        *********************************************************************
        In this step, we text is sent out to Watsons Text to Speech service and result is piped to wave file.
        Wave files are then played using alsa (native audio) tool.
        */

      }else {
        setLEDColor("red", 255);
        console.log("The response (output) text from your conversation is empty. Please check your conversation flow \n" + JSON.stringify( response))
      }

    }

  })

});


textStream.on('error', function(err) {
  console.log(' === Watson Speech to Text : An Error has occurred ===== \nYou may have exceeded your payload quota.') ; // handle errors
  console.log(err + "\n Press <ctrl>+C to exit.") ;
});

function parseText(str){
  var containsWaveArm = (str.indexOf("raise") >= 0 || str.indexOf("weave") >= 0 || str.indexOf("wave") >= 0 || str.indexOf("leave") >= 0 ) && (  str.indexOf("arm") >= 0) ;
  var introduceYourself = str.indexOf("introduce") >= 0 && str.indexOf("yourself") >= 0  ;
  var whatisYourname = str.indexOf("what") >= 0 && str.indexOf("your") >= 0 && str.indexOf("name") >= 0  ;
  var canYouDance = str.indexOf("can") >= 0 && str.indexOf("you") >= 0 && str.indexOf("dance") >= 0  ;


  if (containsWaveArm) {
    speak("Ok, I will wave my arm. Just for you.");
    waveArm("wave") ;
  }else if (introduceYourself){
    speak(" Hi, my name is TJ. I'm an open source project designed to help you access Watson Services in a fun way. You can 3D print me or laser cut me, then use one of my recipes to bring me to life. I can't wait to see what we do together. ");
  }else if (whatisYourname){
    speak(" My name is TJ. You can call me TJ Bot");
  }else if (canYouDance){
    dance();
  }else{
    if (str.length > 10){
      speak("sorry, I haven't been taught to understand that.")
    }
  }


}

/*********************************************************************
* Step #5: Wave Arm
*********************************************************************
*/

var mincycle = 500; var maxcycle = 2300 ;
var dutycycle = mincycle;
var iswaving = false ;

// Setup software PWM on pin 26, GPIO7.

/**
* Wave the arm of your robot X times with an interval
* @return {[type]} [description]
*/
function waveArm(action) {
  iswaving = true ;
  var Gpio = pigpio.Gpio;
  var motor = new Gpio(7, {mode: Gpio.OUTPUT});
  //pigpio.terminate();
  var times =  8 ;
  var interval = 700 ;

  if (action == "wave") {
    var pulse = setInterval(function() {
      motor.servoWrite(maxcycle);
      setTimeout(function(){
        if (motor != null) {
          motor.servoWrite(mincycle);
        }
      }, interval/3);

      if (times-- === 0) {
        clearInterval(pulse);
        if (!isplaying) {
          setTimeout(function(){
            micInstance.resume();
            iswaving = false ;
            setLEDColor("white", 255);
          }, 500);
        }
        return;
      }
    }, interval);
  }else {
    motor.servoWrite(maxcycle);
    setTimeout(function(){
      motor.servoWrite(mincycle);
    }, 400);
  }
}


/*********************************************************************
* Step #6: Convert Text to Speech and Play
*********************************************************************
*/

var Sound = require('node-aplay');
var soundobject ;
var isspeaking = false ;
//speak("testing speaking")
function speak(textstring){

  if (!isspeaking) {

    micInstance.pause(); // pause the microphone while playing
    var params = {
      text: textstring,
      voice: config.voice,
      accept: 'audio/wav'
    };
    text_to_speech.synthesize(params).pipe(fs.createWriteStream('output.wav')).on('close', function() {
      isspeaking = true ;
      soundobject = new Sound("output.wav");
      soundobject.play();
      soundobject.on('complete', function () {
        console.log('Done with playback! for ' + textstring + " iswaving " + iswaving);
        if (!iswaving && !isplaying) {
          micInstance.resume();
          setLEDColor("white", 255)
        }
        isspeaking = false ;
      });
    });

  }
}

/*********************************************************************
* Piece #7: Play a Song and dance to the rythm!
*********************************************************************
*/
var pcmdata = [] ;
var samplerate ;
var soundfile = "sounds/club.wav"
var threshodld = 0 ;
//decodeSoundFile(soundfile);
function decodeSoundFile(soundfile){
  console.log("decoding mp3 file ", soundfile, " ..... ")
  fs.readFile(soundfile, function(err, buf) {
    if (err) throw err
    context.decodeAudioData(buf, function(audioBuffer) {
      console.log(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate, audioBuffer.duration);
      pcmdata = (audioBuffer.getChannelData(0)) ;
      samplerate = audioBuffer.sampleRate;
      findPeaks(pcmdata, samplerate);
      playsound(soundfile);
    }, function(err) { throw err })
  })
}

//dance();
function dance(){
  //speak("Sure. I am decoding a sound file that I will dance to. This may take a couple of seconds.") ;
  decodeSoundFile(soundfile);
}

var isplaying = false ;
function playsound(soundfile){
  micInstance.pause();
  isplaying = true ;
  music = new Sound(soundfile);
  music.play();
  music.on('complete', function () {
    console.log('Done with music playback! .. resuming mic');
    isplaying = false;
    setTimeout(function(){
      micInstance.resume();
      iswaving = false ;
    }, 600);
  });
}

function findPeaks(pcmdata, samplerate, threshold){
  var interval = 0.05 * 1000 ; index = 0 ;
  var step = Math.round( samplerate * (interval/1000) );
  var max = 0 ;   var prevmax = 0 ;  var prevdiffthreshold = 0.3 ;

  //loop through song in time with sample rate
  var samplesound = setInterval(function() {
    if (index >= pcmdata.length) {
      clearInterval(samplesound);
      console.log("finished sampling sound")
      iswaving = false ;
      setLEDColor("white", 255);
      return;
    }
    for(var i = index; i < index + step ; i++){
      max = pcmdata[i] > max ? pcmdata[i].toFixed(1)  : max ;
    }
    // Spot a significant increase? Wave Arm
    if(max-prevmax >= prevdiffthreshold){
      waveArm("dance");
      var colors = Object.keys(colorPalette);
      var randIdx = Math.floor(Math.random() * colors.length);
      var randColor = colors[randIdx];
      setLEDColor( randColor, (max-prevmax) * 255)
    }
    prevmax = max ; max = 0 ; index += step ;
  }, interval,pcmdata);
}


/*********************************************************************
* Piece #8: Vision Recognition
*********************************************************************
*/

var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
var watson = require('watson-developer-cloud');
var fs = require('fs');
var config = require("./config");
var child_process = require('child_process');

var visual_recognition = new VisualRecognitionV3({
  api_key: config.VisionKey,
  version_date: config.VisionVersion
});


var snapinterval =  20000 ; // take a picture every X milliseconds
var i = 0 ;


/**
* Process Images every X seconds
* @return {null} null
*/
function launchVision(){
  var filename = 'photos/pic_'+i+'.jpg';
  //var args = ['-vf', '-hf','-w', '960', '-h', '720', '-o', filename, '-t', '1'];
  var args = ['-w', '960', '-h', '720', '-o', filename, '-t', '5'];
  var spawn = child_process.spawn('raspistill', args);
  spawn.on('exit', function(code) {
    console.log('A photo is saved as '+filename+ ' with exit code, ' + code);
    let timestamp = Date.now();
    processImage(filename)
    i++;
  });
}


/**
* [processImage send the given image file to Watson Vision Recognition for Analysis]
* @param  {[type]} imagefile [description]
* @return {[type]}           [description]
*/
function processImage(imagefile){
  var params = {
    images_file: fs.createReadStream(imagefile)
  };

  var resultstring = "The objects I see are " ;
  visual_recognition.classify(params, function(err, res) {
    if (err){
      console.log(err);
    } else {
      result = res.images[0].classifiers[0].classes
      if(result !== null & result.length > 0){
        result.forEach(function(obj){
          //console.log(obj.class)
          console.log(obj)
          if (obj.score > 0.6){
            resultstring = resultstring + ", " + obj.class
          }

        })
        console.log(resultstring)
        speak(resultstring);
      }else {
        resultstring = "I could not understand that image. Try another?"
        console.log(resultstring)
        speak(resultstring);
      }
    }
  });
}

var ws281x = require('rpi-ws281x-native');
var NUM_LEDS = 1;        // Number of LEDs
ws281x.init(NUM_LEDS);
var color = new Uint32Array(NUM_LEDS);  // array that stores colors for leds

var colorPalette = {
  "red": 0x00ff00,
  "green": 0xff0000,
  "blue": 0x0000ff,
  "purple": 0x008080,
  "yellow": 0xc1ff35,
  "magenta": 0x00ffff,
  "orange": 0xa5ff00,
  "aqua": 0xff00ff,
  "white": 0xffffff
}

setLEDColor("white", 255);

function setLEDColor(randColor, brightness){
  color[0] = colorPalette[randColor];
  ws281x.render(color);
  ws281x.setBrightness(brightness);
}





// ---- Stop PWM before exit
process.on('SIGINT', function () {
  pigpio.terminate();
  process.nextTick(function () { process.exit(0); });
});
