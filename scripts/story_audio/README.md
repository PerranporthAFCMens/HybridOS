Voiceover and music for the marketing video (assets/video/hybridone-story-audio.m4a).

The voiceover is six recordings of the owner (assets/video/voiceover/line1-6.m4a), trimmed and levelled.
`music_and_mix.py` expects them as ../rec/t1.wav ... t6.wav (44.1 kHz mono wav), generates the music bed (no third-party music), ducks it under the voice and writes mix.wav.
Then: `ffmpeg -i mix.wav -c:a aac -b:a 96k assets/video/hybridone-story-audio.m4a` and run scripts/render_story_video.py.
Start times: 0.5, 4.5, 9.4, 13.1, 19.8, 25.3 seconds. `clean_recordings.py` trims each raw recording to the speech only (drops button taps and noise) and levels it.
