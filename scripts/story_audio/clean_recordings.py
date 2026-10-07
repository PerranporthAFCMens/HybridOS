import numpy as np,subprocess
from scipy.io import wavfile
for i in range(1,7):
    sr,a=wavfile.read(f'r{i}.wav');x=a.astype(float)/32768
    W=int(sr*0.02);n=len(x)//W
    db=20*np.log10(np.sqrt((x[:n*W].reshape(n,W)**2).mean(1))+1e-6)
    act=db>-36
    runs=[];s=None
    for k,v in enumerate(act):
        if v and s is None:s=k
        if not v and s is not None:runs.append([s,k]);s=None
    if s is not None:runs.append([s,n])
    m=[]
    for r in runs:
        if m and (r[0]-m[-1][1])*0.02<=0.2:m[-1][1]=r[1]
        else:m.append(r)
    dur=lambda r:(r[1]-r[0])*0.02
    keep=list(m)
    while len(keep)>1 and dur(keep[0])<0.35:keep.pop(0)
    while len(keep)>1 and dur(keep[-1])<0.35:keep.pop()
    drop=[(round(r[0]*.02,2),round(r[1]*.02,2)) for r in m if r not in keep]
    st=keep[0][0]*0.02;en=keep[-1][1]*0.02
    st=max(st,{4:0.59}.get(i,0))  # 0.41-0.50s is a button tap in recording 4
    print(i,'runs',[(round(r[0]*.02,2),round(r[1]*.02,2)) for r in m],'dropped',drop,'keep',round(st,2),round(en,2))
    seg=x[max(0,int((st-0.06)*sr)):min(len(x),int((en+0.12)*sr))]
    f=int(0.02*sr);seg[:f]*=np.linspace(0,1,f);seg[-f:]*=np.linspace(1,0,f)
    wavfile.write(f'c{i}.wav',sr,(seg*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'c{i}.wav','-af','highpass=f=80,afftdn=nr=10:nf=-45,loudnorm=I=-18:TP=-2:LRA=7','-ar','44100','-ac','1',f't{i}.wav'],check=True)
    sr2,b=wavfile.read(f't{i}.wav');print('  final',round(len(b)/sr2,2))
