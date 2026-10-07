Voiceover and music for the marketing video (assets/video/hybridone-story-audio.m4a).

1. Download the Kokoro model files `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` (thewh1teagle/kokoro-onnx, release model-files-v1.0) into the working folder.
2. `python3 voiceover.py` writes l1.wav ... l7.wav (British male voice, text written as phonemes).
3. `python3 music_and_mix.py` writes the generated music bed (no third-party music) and the final mix.wav, with the music ducked under the voice.
4. `ffmpeg -i mix.wav -c:a aac -b:a 96k assets/video/hybridone-story-audio.m4a`, then run scripts/render_story_video.py.
