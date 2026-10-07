import numpy as np,onnxruntime as ort
from scipy.io import wavfile
V={'$':0,';':1,':':2,',':3,'.':4,'!':5,'?':6,'—':9,'…':10,'"':11,'(':12,')':13,'“':14,'”':15,' ':16,'A':24,'I':25,'O':31,'Q':33,'W':39,'Y':41,'ᵊ':42,
'a':43,'b':44,'c':45,'d':46,'e':47,'f':48,'h':50,'i':51,'j':52,'k':53,'l':54,'m':55,'n':56,'o':57,'p':58,'q':59,'r':60,'s':61,'t':62,'u':63,'v':64,'w':65,'x':66,'y':67,'z':68,
'ɑ':69,'ɐ':70,'ɒ':71,'æ':72,'ɔ':76,'ð':81,'ʤ':82,'ə':83,'ɛ':86,'ɜ':87,'ɡ':92,'ɪ':102,'ŋ':112,'ɹ':123,'ʃ':131,'ʧ':133,'ʊ':135,'ʌ':138,'ʒ':147,'θ':119,'ˈ':156,'ˌ':157,'ː':158}
LINES={
'l1':"jˈɔː hˈQl ʤˈɪm. ˈɔːl ɪn wˈʌn plˈAs.",
'l2':"ɹˈIt nˈW ɪts fˈIv ˈæps, fˈIv lˈɒɡɪnz, ənd wˈʌn bˈɪɡ hˈɛdAk.",
'l3':"sˈQ wi pˈʊt ɪt ˈɔːl ɪn wˈʌn. hˈIbɹɪd wˈʌn.",
'l4':"jˈɔː mˈɛmbəz bˈʊk klˈɑːsɪz, lˈɒɡ ðˈɛː wˈɜːkWts, ənd ʧˈAs njˈuː pˈɜːsənəl bˈɛsts, ˈɔːl fɹɒm wˈʌn ˈæp.",
'l6':"ənd ɪts jˈɔːz. pˈɒp jˈɔː lˈQɡQ ɪn wˈʌns, ənd ɪt ʃˈQz ˈʌp ˈɛvɹɪwˌɛː.",
'l7':"hˈIbɹɪd wˈʌn. ɹˈʌn jˈɔː ʤˈɪm fɹɒm wˈʌn plˈAs."}
AUS={'A':'ʌɪ','Q':'ɐʊ','I':'ɑɪ','W':'æɔ'}
s=ort.InferenceSession('kokoro-v1.0.int8.onnx');v=np.load('voices-v1.0.bin',allow_pickle=True)['bm_george']
for k,t in LINES.items():
    miss=[c for c in t if c not in V];assert not miss,(k,miss)
    t=''.join(AUS.get(c,c) for c in t);V['ɐ']=70
    ids=[0]+[V[c] for c in t]+[0]
    a=s.run(None,{'tokens':np.array([ids],dtype=np.int64),'style':v[len(ids)-2].astype(np.float32),'speed':np.array([1.1],dtype=np.float32)})[0].squeeze()
    wavfile.write(k+".wav",24000,(a*32767).astype(np.int16));print(k,round(len(a)/24000,2),'s peak',round(float(abs(a).max()),2))
