"""Render assets/video/story.html to assets/video/hybridone-story.mp4 (30s, 1280x720, 30fps).
Usage: python3 scripts/render_story_video.py [frames_dir]   (needs Playwright + ffmpeg)"""
import os,subprocess,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'assets/video/hybridone-story.mp4';poster=ROOT/'assets/video/hybridone-story-poster.jpg'
frames=Path(sys.argv[1]) if len(sys.argv)>1 else Path(tempfile.mkdtemp())
frames.mkdir(parents=True,exist_ok=True)
FPS,DUR=30,30
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1280,'height':720})
    pg.goto((ROOT/'assets/video/story.html').as_uri());pg.wait_for_timeout(800)
    for f in range(FPS*DUR):
        pg.evaluate('t=>window.seek(t)',f/FPS);pg.screenshot(path=str(frames/f'f{f:04d}.jpg'),type='jpeg',quality=92)
    pg.evaluate('t=>window.seek(t)',16.9);pg.screenshot(path=str(poster),type='jpeg',quality=85)
    b.close()
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(FPS),'-i',str(frames/'f%04d.jpg'),'-c:v','libx264','-preset','slow','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
print(out,out.stat().st_size)
