import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,lfilter
SR=44100;DUR=30.0;N=int(SR*DUR);t=np.arange(N)/SR
def rs(x,sr):
    return np.interp(np.arange(int(len(x)*SR/sr))/SR*sr,np.arange(len(x)),x)
def lp(x,f,o=2):b,a=butter(o,f/(SR/2));return lfilter(b,a,x)
def hp(x,f,o=2):b,a=butter(o,f/(SR/2),'high');return lfilter(b,a,x)
bpm=104;beat=60/bpm;bar=beat*4
# chords per bar: Am F C G (midi roots)
chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
mf=lambda m:440*2**((m-69)/12)
pad=np.zeros(N);bass=np.zeros(N);arp=np.zeros(N)
nb=int(DUR/bar)+1
for b in range(nb):
    t0=b*bar;ch=chords[b%4];i0=int(t0*SR);i1=min(N,int((t0+bar)*SR))
    if i0>=N:break
    tt=t[i0:i1]-t0;env=np.minimum(1,tt/0.6)*np.minimum(1,(bar-tt)/0.5)
    for m in ch:
        for det in(-0.6,0.6):
            pad[i0:i1]+=np.sin(2*np.pi*mf(m)*(1+det/1000)*tt)*env*0.10+0.04*np.sin(2*np.pi*2*mf(m)*tt)*env*0.5
    r=mf(ch[0]-12)
    for k in range(8):
        s=int((t0+k*beat/2)*SR);e=min(N,s+int(beat/2*SR))
        if s>=N:break
        tt2=np.arange(e-s)/SR;bass[s:e]+=np.sin(2*np.pi*r*tt2)*np.exp(-tt2*5)*0.28*(1 if k%2==0 else 0.7)
    notes=[ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+12,ch[2]+12,ch[1]+12,ch[0]+12,ch[1]+12]
    for k,m in enumerate(notes):
        s=int((t0+k*beat/2)*SR);e=min(N,s+int(0.4*SR))
        if s>=N:break
        tt2=np.arange(e-s)/SR;arp[s:e]+=np.sin(2*np.pi*mf(m+12)*tt2)*np.exp(-tt2*7)*0.06
pad=lp(pad,1800)
# drums: soft kick on each beat, closed hat on offbeats; enter at 4s
drum=np.zeros(N);rng=np.random.default_rng(3)
for k in range(int(DUR/beat)):
    ts=k*beat
    if ts<4:continue
    s=int(ts*SR);e=min(N,s+int(0.25*SR));tt2=np.arange(e-s)/SR
    f=45+90*np.exp(-tt2*30);drum[s:e]+=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt2*14)*0.55
    s2=int((ts+beat/2)*SR);e2=min(N,s2+int(0.05*SR))
    if s2<N:drum[s2:e2]+=hp(rng.standard_normal(e2-s2),6000,1)*np.exp(-np.arange(e2-s2)/SR*70)*0.05
music=pad+bass+arp*(t>2)+drum
music/=np.abs(music).max()
# voice
sched=[('l1',0.4),('l2',4.9),('l3',8.7),('l4',11.4),('l6',19.6),('l7',25.9)]
voice=np.zeros(N);duck=np.ones(N)
for k,st in sched:
    sr,a=wavfile.read(k+'.wav');a=rs(a.astype(np.float32)/32767,sr)
    a=hp(a,70,1);i=int(st*SR);e=min(N,i+len(a));voice[i:e]+=a[:e-i]
    d=np.ones(N);d[max(0,i-int(.15*SR)):min(N,e+int(.35*SR))]=0.42;duck=np.minimum(duck,d)
b,a_=butter(1,6/(SR/2));duck=lfilter(b,a_,duck)
voice/=np.abs(voice).max();voice*=0.9
music*=duck*0.38
fade=np.minimum(1,t/1.5)*np.minimum(1,(DUR-t)/2.0)
mix=(voice+music)*fade
mix=np.tanh(mix*1.1)/np.tanh(1.1)
mix/=np.abs(mix).max()/0.92
wavfile.write('mix.wav',SR,(mix*32767).astype(np.int16))
print('ok',round(float(np.sqrt((mix**2).mean())),3))
