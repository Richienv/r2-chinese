import json, html, re, shutil, hashlib
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'src/data/jiayin-english.json').read_text())
SOURCE=json.loads((ROOT/'src/data/jiayin.json').read_text())
Q={q['id']:q for q in DATA['questions']}
ZH={q['id']:q for u in SOURCE['units'] for q in u['items']}
OUT=ROOT/'output/pdf/Jiayin_MT_English_First_Prep_EN_ID.pdf'
PUBLIC=ROOT/'public/preparation'/OUT.name
F=Path('/System/Library/Fonts/Supplemental')
for name,file in [('Body','Arial.ttf'),('Bold','Arial Bold.ttf'),('Title','Baskerville.ttc'),('Han','Arial Unicode.ttf')]:pdfmetrics.registerFont(TTFont(name,str(F/file)))
INK=HexColor('#1b292f');GRAY=HexColor('#516169');GREEN=HexColor('#195b5e');LINE=HexColor('#c4ced1')
W,H=A4;LEFT=46;WIDTH=W-92
STYLE={
 'body':ParagraphStyle('body',fontName='Body',fontSize=10.2,leading=14.2,textColor=INK),
 'en':ParagraphStyle('en',fontName='Body',fontSize=11,leading=15.5,textColor=INK),
 'id':ParagraphStyle('id',fontName='Body',fontSize=9.5,leading=13.2,textColor=GRAY),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8.7,leading=11.7,textColor=GRAY),
 'head':ParagraphStyle('head',fontName='Bold',fontSize=11.2,leading=15.5,textColor=INK),
 'question':ParagraphStyle('question',fontName='Bold',fontSize=11.6,leading=16,textColor=GREEN),
 'zh':ParagraphStyle('zh',fontName='Han',fontSize=13.2,leading=19,wordWrap='CJK',textColor=INK),
 'py':ParagraphStyle('py',fontName='Han',fontSize=9.4,leading=13.4,wordWrap='CJK',textColor=GRAY),
}
c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
c.setTitle('Jiayin Global MT - English-first Interview Preparation | EN-ID')
c.setAuthor('Richie | R2 Chinese')
c.setSubject('CV, stakeholders, project execution, China-Indonesia coordination, data and founder experience; Mandarin optional')
y=0;page=0;lows=[];models=[];sourcephrases=[]
def p(text,kind='body',gap=6):
 global y
 text=re.sub(r'[\u2010-\u2015\u2212]', '-', text)
 style=STYLE[kind]
 cmap=pdfmetrics.getFont(style.fontName).face.charToGlyph
 if any(ord(v) not in cmap for v in text if not v.isspace()):style=ParagraphStyle(style.name+'Han',parent=style,fontName='Han',wordWrap='CJK')
 para=Paragraph(html.escape(text),style)
 _,height=para.wrap(WIDTH,1000);y-=height
 if y<59:raise ValueError(f'Overflow page {page} at {y}: {text[:90]}')
 para.drawOn(c,LEFT,y);y-=gap;lows.append((page,y))
def head(text):
 global y
 y-=5;p(text,'head',7)
def start(title,sub):
 global y,page
 if page:c.showPage()
 page+=1;c.setFillColor(GREEN);c.setFont('Bold',8);c.drawString(LEFT,H-31,'JIAYIN  /  GLOBAL MT  /  ENGLISH + INDONESIA')
 c.setFillColor(INK);c.setFont('Title',23);c.drawString(LEFT,H-65,title)
 c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(LEFT,H-78,W-LEFT,H-78)
 y=H-94;p(sub,'id',9)
 c.setFillColor(GRAY);c.setFont('Body',8);c.drawString(LEFT,30,'14 Oktober 2026  |  Persiapan isi untuk wawancara 15 Oktober')
 c.drawRightString(W-LEFT,30,f'{page} / 10');c.setStrokeColor(LINE);c.line(LEFT,44,W-LEFT,44)
def qa(key,coach=True):
 q=Q[key];p(q['questionEn'],'question',7);p(q['answerEn'],'en',7);models.append((page,key,q['answerEn']))
 if coach:p(q['coachId'],'id',9)
def notes(label,lines=2):
 global y
 p(label,'id',3)
 for _ in range(lines):
  y-=18
  if y<59:raise ValueError(f'Notes overflow page {page}')
  c.setStrokeColor(LINE);c.setLineWidth(.4);c.line(LEFT,y,W-LEFT,y)
 y-=8
def short(text,label):
 head(label);p(text,'en',7)

start('01  Positioning dan pembuka','Asumsi latihan: wawancara dalam English. Penjelasan Indonesia. Mandarin sepenuhnya opsional di halaman 10.')
head('Pesan yang harus diingat interviewer')
p(DATA['positioning'],'en',6);p(DATA['positioningId'],'id',9)
qa('intro')
head('Lima kekuatan, urut sesuai relevansi MT')
for index,item in enumerate(DATA['pillars']):p(f"{index+1}. {item['title']}: {item['relevance']}",'body',6)
head('Cara latihan setiap jawaban')
p('Pahami maksudnya > jawab tanpa skrip > bandingkan dengan contoh > cek fakta dan kontribusi pribadi > ulang hanya dengan petunjuk. Contoh English adalah pembuka; cerita nyata tetap harus kamu isi.','body',7)
notes('Tiga bukti yang ingin saya tonjolkan',2)

start('02  Stakeholder Indonesia dan BD','Prioritas pertama dari saran temanmu: hubungan bisnis, negosiasi, dan tindak lanjut. Pengalaman industri adalah dasar transferable.')
qa('stakeholders')
qa('supply')
head('Isi satu cerita pertemuan atau pengadaan')
notes('Stakeholder, kebutuhan, dan informasi yang saya siapkan',2)
notes('Tindakan saya; keputusan akhir direktur / owner',2)
notes('Hasil dan tindak lanjut yang bisa saya buktikan',2)
p('Bayan, Kideco, SANY adalah mitra bisnis. Hindari klaim sales quota, nilai kontrak, atau jaringan fintech yang belum ada.','small',0)

start('03  Proyek lintas tim: ERP','Bukti project management paling kuat: tim, prioritas, proses bisnis, penerapan dan hasil. Stack hanya jika ditanya.')
qa('erp')
qa('team')
head('Cerita satu modul: jangan berhenti pada angka skala')
notes('Modul + pengguna + masalah sebelum',2)
notes('Keputusan pribadi + trade-off + cara koordinasi',2)
notes('Hasil + metrik + periode + sumber bukti',2)

start('04  Jembatan HQ dan Indonesia','Hubungkan komunikasi dengan keputusan dan eksekusi. Bukan hanya kemampuan menerjemahkan.')
qa('bridge')
qa('why-jiayin')
head('Bahasa kerja: jawaban pendek yang jujur')
p('Indonesian is my native language, and I can work fluently in English. My Mandarin is around HSK 3–4 for everyday communication. For complex business discussions, I prefer English or written confirmation so the meaning is accurate.','en',6)
p('Tinggal dan studi di China memberi exposure lintas budaya; tidak otomatis berarti berpengalaman kerja korporat China. Konfirmasi tujuan, definisi, owner dan deadline pada setiap tim.','id',7)
notes('Contoh perbedaan pemahaman yang pernah saya luruskan',2)

start('05  Data yang menghasilkan keputusan','Proyek Bayan, ERP dan business AI agent membuktikan dasar analitis. Jelaskan pertanyaan bisnis dan cara memeriksa hasil.')
qa('data')
qa('agent')
head('75% dan 95,1%: siap menjelaskan apa yang diukur')
p('75%: sebut nama metrik dan unit, baseline, kondisi sesudah, sampel, periode dan sumber bukti. Klaim “faster” tidak otomatis sama dengan waktu turun 75%. Jika bukti persis belum tersedia, pakai hasil yang bisa dipastikan. Copilot 95,1%: development-set, bukan blind test atau akurasi produksi.','body',7)
notes('Satu data exception asli + aturan validasi / rekonsiliasi saya',2)
notes('Bukti hasil atau rincian pengukuran yang perlu saya siapkan',2)

start('06  Founder, MT dan peran bisnis','Tekankan ownership, customer thinking, kesiapan rotasi dan komitmen bekerja dalam struktur tim.')
qa('founder')
qa('why-mt')
qa('business')
notes('Satu keputusan produk asli: kebutuhan pengguna, pilihan, dan bukti',2)

start('07  Fintech dan rencana awal','Tunjukkan judgement bisnis yang realistis. Contoh kasus bersifat hipotetis, bukan pengalaman kerja di perkreditan.')
head('Pahami alur bisnis sebelum memberi solusi')
p(DATA['role']['businessEn'],'body',5)
p(DATA['role']['journeyId'],'id',7)
qa('financial-gap')
qa('first-30')
head('Kasus partner: dari peluang ke pilot')
p('Tentukan tujuan kerja sama; verifikasi entitas, asal customer, izin data, dan biaya. Bandingkan kualitas customer dan keluhan, bukan volume atau CAC saja. Buat pilot dengan metrik, owner, batas risiko dan stop condition. Pengadaan industri adalah skill transferable; kanal kredit adalah domain baru.','body',7)
head('Kasus funnel: hitung sebelum menyimpulkan')
p('10.000 visits > 6.000 registrations > 2.400 applications > 1.800 approvals > 1.440 disbursements. Konversi tahap: 60% / 40% / 75% / 80%; total 14,4%. Samakan cohort, periode dan denominator. Data satu periode belum membuktikan penurunan. Bandingkan baseline/segmen; periksa form, verification, error dan fee clarity sebelum uji kecil.','body',7)
p('Untuk kasus operasi/AI: tangani dampak pengguna sesuai wewenang, verifikasi transaksi dan sumber data, koordinasikan owner, lalu uji perbaikan. Nominal pembayaran harus dari sistem terotorisasi, bukan tebakan model.','id',7)
notes('Pilihan masalah pertama + baseline + ukuran hasil',1)

start('08  CV lanjutan, mulai kerja, penutup','CV yang dikirim menjadi acuan. Ada versi lama dengan perbedaan tanggal; pastikan jawaban dan dokumen konsisten.')
short('At Kambyan, I worked on database structure and operational data for a drone-automation project. It gave me a foundation in data quality that I later applied to enterprise workflows.','Kambyan: dasar data, bukan cerita drone panjang')
short('My Computer Science background gives me an analytical foundation. The English-taught GMBA helps me connect it with strategy, finance, operations and international business. My latest-term weighted average is 89.21 out of 100, not a cumulative GPA.','Taylor’s dan ZJU: hubungkan pendidikan ke bisnis')
short('I distinguish hosted products that are pre-launch from specific client work in my resume. If I join full-time, the job is my priority, and I will follow rules on outside work, conflicts of interest and intellectual property.','WeUseAI dan side projects: scope dan komitmen')
qa('start')
head('Tiga pertanyaan balik')
for item in DATA['backQuestions']:p(item['en'],'body',6)
head('Penutup');p(DATA['closingEn'],'en',7)
p('Cek sebelum masuk: tanggal akhir Taylor’s/Kambyan dan angka Taylor’s pada CV yang benar-benar dikirim; scope pekerjaan klien TRO Creative / Hansaplast; klaim 75%; timeline full-time 1 Mei 2027 versus gelar Juni.','small',0)

start('09  Simulasi English tanpa skrip','Tutup halaman 1-8. Rekam jawaban lisan; sesudahnya cek isi dan fakta. Contoh yang dibuka membuat percobaan itu berbantuan.')
p('Nilai sendiri: 0 = belum bisa; 1 = perlu contoh / isi belum lengkap; 2 = mandiri, jelas, dan faktanya dapat dijelaskan. Ini bukan pemeriksaan bahasa atau fakta otomatis.','body',8)
for index,q in enumerate(x for x in DATA['questions'] if x['priority']):p(f"{index+1:02}. {q['questionEn']}  Nilai: __ / 2",'body',6)
head('Dua cerita wajib asli: kegagalan dan konflik')
notes('Kegagalan: situasi, keputusan saya, dampak, pemulihan, perubahan',2)
notes('Konflik: dua tujuan, bukti, komunikasi, keputusan owner, hasil',2)
head('Rencana malam ini: 75 menit')
for step in DATA['nightPlan']:p(step,'id',4)
p('Besok: 13:30 cek perangkat, 13:50 siap masuk, 14:00 wawancara Tencent; sediakan waktu hingga 16:30 menurut sumber. Ikuti zona waktu undangan; UTC+8 masih asumsi.','small',0)

start('10  Mandarin opsional','Lewati halaman ini untuk fokus pada English. Gunakan frasa hanya untuk memahami pertanyaan, meminta klarifikasi, atau menjelaskan lebih akurat.')
for key,label in [('phrase1','Belum paham pertanyaan'),('phrase2','Memastikan maksud'),('phrase3','Minta menjelaskan dalam English')]:
 head(label);item=ZH[key];p(item['answerZh'],'zh',2);p(item['chunkPinyin'][0],'py',3);p(item['answerId'],'id',8);sourcephrases.append(item['answerZh'])
head('Kenali pertanyaan yang mungkin terdengar')
for key in ['q02','q10','q41']:
 item=ZH[key];p(item['questionZh'],'zh',2);p(item['questionPinyin'],'py',3);p(item['questionId'],'id',7);sourcephrases.append(item['questionZh'])
head('Angka jika ingin menyebut bukti dalam Mandarin')
p('15 orang: 十五人 / shíwǔ rén. 12 sistem: 十二个系统 / shí’èr gè xìtǒng. 1.000 pengguna: 一千名用户 / yìqiān míng yònghù.','py',8)
p('Materi ini mengubah fokus dari hafalan Mandarin menjadi isi wawancara English. Contoh English disusun ulang berdasarkan materi wawancara revisi 11 Oktober 2026, CV International Business / Digital Transformation, serta arahanmu 14 Oktober. Rotasi aktual, mentor, entitas, training dan jalur jabatan harus dikonfirmasi.','small',5)
p('CV lama mencantumkan akhir Taylor’s Maret dan Kambyan Januari 2023; materi wawancara terbaru mencatat Juli 2023. Angka Taylor’s juga berbeda antarversi. Cocokkan dokumen yang dikirim dan bukti pribadi. Tidak ada tanggal atau capaian baru yang diasumsikan untuk menyelesaikan perbedaan ini.','small',0)

assert page==10;c.save()
r=PdfReader(str(OUT));assert len(r.pages)==10
norm=lambda t:re.sub(r'\s+','',t)
for num,key,text in models:assert norm(text) in norm(r.pages[num-1].extract_text()),(num,key)
for pg in r.pages[:9]:assert not re.search(r'[\u3400-\u9fff]',pg.extract_text())
for pg in r.pages:assert abs(float(pg.mediabox.width)-W)<.01 and abs(float(pg.mediabox.height)-H)<.01
# Mandarin is the unchanged source text in jiayin.json; extracted output must preserve it.
for phrase in sourcephrases:assert norm(phrase) in norm(r.pages[9].extract_text())
PUBLIC.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(OUT,PUBLIC)
assert OUT.read_bytes()==PUBLIC.read_bytes()
print(json.dumps({'output':str(OUT),'pages':len(r.pages),'English_models':len(models),'Mandarin_only_on_page':10,'lowest_y':min(value for _,value in lows),'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()}))
