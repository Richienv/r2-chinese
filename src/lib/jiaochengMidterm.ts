import { t } from './i18n.ts'
import { weakGrammarPoints, type LearnerGraphState } from './learnerGraph.ts'

export type ExamCourse = 'jiaocheng' | 'hsk4a' | 'mixed'
export type ExamMode = 'mock' | 'grammar'

export interface BilingualText {
  en: string
  id: string
}

export interface DistractorNote {
  option: string
  whyWrong: BilingualText
}

export interface GrammarBreakdown {
  pattern: string
  grammarTag: string
  whyRight: BilingualText
  distractorNotes: DistractorNote[]
  focusWords?: string[]
  confusionPairs?: Array<[string, string]>
}

/** One numbered blank inside a printed textbook sentence. */
export interface ExamBlank {
  n: number
  answer: string
}

interface BasePart {
  id: string
  course: 'jiaocheng' | 'hsk4a'
  lesson: number
  title: string
  sectionZh: string
  breakdown: GrammarBreakdown
}

export interface FillPart extends BasePart {
  kind: 'blanks'
  zh: string
  bank: string[]
  /** `{{n}}` marks blank n. */
  lines: string[]
  blanks: ExamBlank[]
}

export interface ChoicePart extends BasePart {
  kind: 'choice'
  material: string
  options: string[]
  answer: string
  why: string
}

export interface OrderPart extends BasePart {
  kind: 'order'
  /** Scrambled sentence chunks displayed as tap tiles. */
  chunks: string[]
  /** Target chunk sequence joining to `answer`. */
  answerOrder: string[]
  answer: string
  hint?: BilingualText
}

export interface ErrorPart extends BasePart {
  kind: 'error'
  faultySentence: string
  errorFocus: string
  options: string[]
  answer: string
}

export interface ReadingPart extends BasePart {
  kind: 'reading'
  passage: string
  question: string
  options: string[]
  answer: string
}

export type ExamPart = FillPart | ChoicePart | OrderPart | ErrorPart | ReadingPart

function fill(
  id: string,
  course: 'jiaocheng' | 'hsk4a',
  lesson: number,
  zh: string,
  bank: string[],
  lines: string[],
  answers: string[],
  breakdown: GrammarBreakdown,
): FillPart {
  return {
    kind: 'blanks',
    id,
    course,
    lesson,
    title: t('Fill in the blanks'),
    sectionZh: '选词填空',
    zh,
    bank,
    lines,
    blanks: answers.map((answer, index) => ({ n: index + 1, answer })),
    breakdown,
  }
}

function choice(
  id: string,
  course: 'jiaocheng' | 'hsk4a',
  lesson: number,
  material: string,
  options: string[],
  answer: string,
  why: string,
  breakdown: GrammarBreakdown,
): ChoicePart {
  return {
    kind: 'choice',
    id,
    course,
    lesson,
    title: t('Single choice'),
    sectionZh: '语法选择',
    material,
    options,
    answer,
    why,
    breakdown,
  }
}

function order(
  id: string,
  course: 'jiaocheng' | 'hsk4a',
  lesson: number,
  chunks: string[],
  answerOrder: string[],
  breakdown: GrammarBreakdown,
  hint?: BilingualText,
): OrderPart {
  return {
    kind: 'order',
    id,
    course,
    lesson,
    title: t('Sentence ordering'),
    sectionZh: '语序排列',
    chunks,
    answerOrder,
    answer: answerOrder.join(''),
    ...(hint ? { hint } : {}),
    breakdown,
  }
}

function errorFix(
  id: string,
  course: 'jiaocheng' | 'hsk4a',
  lesson: number,
  faultySentence: string,
  errorFocus: string,
  options: string[],
  answer: string,
  breakdown: GrammarBreakdown,
): ErrorPart {
  return {
    kind: 'error',
    id,
    course,
    lesson,
    title: t('Fix the grammar error'),
    sectionZh: '病句修改',
    faultySentence,
    errorFocus,
    options,
    answer,
    breakdown,
  }
}

function reading(
  id: string,
  course: 'jiaocheng' | 'hsk4a',
  lesson: number,
  passage: string,
  question: string,
  options: string[],
  answer: string,
  breakdown: GrammarBreakdown,
): ReadingPart {
  return {
    kind: 'reading',
    id,
    course,
    lesson,
    title: t('Reading comprehension'),
    sectionZh: '阅读理解',
    passage,
    question,
    options,
    answer,
    breakdown,
  }
}

/** 汉语教程 第二册 上+下 (Lessons 1–25): authentic Midterm & Final Prep across all 5 question types. */
export function buildJiaochengMidterm(): ExamPart[] {
  return [
    fill(
      'l1-bu',
      'jiaocheng',
      1,
      '选词填空 · 不 / 没有',
      ['不', '没有'],
      [
        '1. 我明天{{1}}去超市，我要去书店。',
        '2. 昨天我{{2}}去商店，我去书店了。',
        '3. 那个电影我{{3}}看。',
        '4. 玛丽，你想{{4}}想家？',
      ],
      ['不', '没有', '没有', '不'],
      {
        pattern: 'Subject + 不 + V (future/habit/A-不-A) | Subject + 没(有) + V (past/uncompleted)',
        grammarTag: '不 / 没有',
        whyRight: {
          en: 'Use 不 for future plans, willingness, or A-不-A questions (想不想); use 没有 to negate completed past actions (昨天没去, 那个电影没看).',
          id: 'Pakai 不 untuk rencana masa depan, kemauan, atau kalimat tanya A-不-A (想不想); pakai 没有 untuk menyangkal kejadian lampau yang tidak dilakukan (昨天没有去, 那个电影没有看).',
        },
        distractorNotes: [
          {
            option: '不 (on past action)',
            whyWrong: {
              en: '不 does not negate a single past event like 昨天; it would sound like a refusal or general habit.',
              id: '不 tidak menyangkal kejadian tunggal di masa lalu seperti 昨天; maknanya nanti terdengar seperti penolakan atau kebiasaan.',
            },
          },
          {
            option: '没有 (in 想没有想家)',
            whyWrong: {
              en: 'Mental/volitional verbs in A-not-A form with future or general state use 想不想, not 没有.',
              id: 'Bentuk tanya A-not-A untuk keadaan batin sekarang memakai 想不想, bukan 没有.',
            },
          },
        ],
        focusWords: ['不', '没有'],
        confusionPairs: [['不', '没有']],
      },
    ),
    fill(
      'l1-zai',
      'jiaocheng',
      1,
      '选词填空 · 再 / 又',
      ['再', '又'],
      [
        '1. 上次比赛我们赢了，这次{{1}}赢了。',
        '2. 这本词典很好，我已经买了一本，想{{2}}买一本给我弟弟。',
        '3. 我昨天已经去了，今天不想{{3}}去了。',
        '4. 我{{4}}买了一个手机。',
        '5. 我觉得一年时间太短了，我想{{5}}学一年。',
      ],
      ['又', '再', '再', '又', '再'],
      {
        pattern: '又 + Verb + 了 (already repeated) | 想/要 + 再 + Verb (planned/future repetition)',
        grammarTag: '再 / 又',
        whyRight: {
          en: '又 marks an action or event that ALREADY repeated (这次又赢了, 我又买了一个手机); 再 marks an unrealized or intended repetition (想再买, 不想再去, 想再学一年).',
          id: '又 menandai pengulangan yang SUDAH terjadi (这次又赢了, 又买了一个手机); 再 menandai pengulangan yang BELUM terjadi atau masih rencana (想再买, 不想再去, 想再学一年).',
        },
        distractorNotes: [
          {
            option: '再 + 赢了 (realized past)',
            whyWrong: {
              en: '再 cannot describe an already completed repetition in the past; use 又 for completed repeats.',
              id: '再 tidak dipakai untuk pengulangan yang sudah selesai terjadi di masa lalu; pakai 又.',
            },
          },
          {
            option: '想 + 又 + 买',
            whyWrong: {
              en: 'After desire/plan verbs like 想, you must use 再 for a future repeat.',
              id: 'Setelah kata niat/rencana seperti 想, pengulangan di masa depan wajib memakai 再.',
            },
          },
        ],
        focusWords: ['再', '又'],
        confusionPairs: [['再', '又']],
      },
    ),
    fill(
      'l1-ci',
      'jiaocheng',
      1,
      '选词填空',
      ['已经', '考', '接', '踢', '比赛', '操场', '又', '出国'],
      [
        '1. 我下午去操场{{1}}足球了。',
        '2. 妈妈不想让我{{2}}留学。',
        '3. 你昨天是不是{{3}}去他家了？',
        '4. 他正在{{4}}电话呢。',
        '5. 玛丽在{{5}}打太极拳呢。',
        '6. 我们又跟外贸大学进行篮球{{6}}。',
        '7. 我姐姐{{7}}大学毕业了。',
        '8. 很多留学生都想{{8}}HSK。',
      ],
      ['踢', '出国', '又', '接', '操场', '比赛', '已经', '考'],
      {
        pattern: 'Verb-Object Collocations (踢足球 / 接电话 / 考HSK / 进行比赛)',
        grammarTag: '动词搭配 (Collocations)',
        whyRight: {
          en: 'Each slot requires an exact Mandarin collocation: 踢足球 (kick soccer), 接电话 (answer phone), 出国留学 (study abroad), 进行比赛 (hold a match), 考HSK (take HSK).',
          id: 'Setiap bagian butuh pasangan kata kerja yang tepat: 踢足球 (main bola), 接电话 (angkat telepon), 出国留学 (kuliah ke luar negeri), 进行比赛 (bertanding), 考HSK (ikut ujian HSK).',
        },
        distractorNotes: [
          {
            option: 'Swapping 考 and 比赛',
            whyWrong: {
              en: '进行 takes noun objects like 比赛 (a match), whereas 考 pairs directly with exam names like HSK.',
              id: '进行 berpasangan dengan kata benda kegiatan seperti 比赛, sedangkan 考 langsung diikuti nama ujian seperti HSK.',
            },
          },
        ],
        focusWords: ['又', '已经', '比赛'],
      },
    ),
    fill(
      'l2',
      'jiaocheng',
      2,
      '选词填空',
      ['感到', '难过', '所以', '又', '疼', '总', '拉', '检查'],
      [
        '1. 昨天晚上我{{1}}肚子了。',
        '2. 我的肚子{{2}}得很厉害。',
        '3. 刚来中国的时候，我{{3}}想家。',
        '4. 大夫{{4}}以后说我不是得了肠炎。',
        '5. 她{{5}}发烧了。',
        '6. 别{{6}}了，我们一起去跳跳舞吧。',
        '7. 因为我爸爸在中国工作，{{7}}要我来中国留学。',
        '8. 有时候我也{{8}}寂寞，但是过一会儿就好了。',
      ],
      ['拉', '疼', '总', '检查', '又', '难过', '所以', '感到'],
      {
        pattern: '因为……所以…… | 动词 + 得 + 很厉害 | 感到 + Adjective',
        grammarTag: '因为…所以 / 程度补语',
        whyRight: {
          en: 'Matches Lesson 2 health & emotion collocations: 拉肚子 (diarrhea), 疼得很厉害 (hurts badly), 总想家 (always homesick), 检查以后 (after examination), 因为…所以… (because…so).',
          id: 'Sesuai kolokasi kesehatan & perasaan Pelajaran 2: 拉肚子 (diare), 疼得很厉害 (sakit banget), 总想家 (selalu kangen rumah), 检查以后 (setelah diperiksa), 因为…所以… (karena…jadi).',
        },
        distractorNotes: [
          {
            option: 'Using 难过 in 感到__寂寞',
            whyWrong: {
              en: '感到 takes an adjective object here (感到寂寞 = feel lonely); 别难过了 comforts someone who feels sad.',
              id: '感到 di sini diikuti kata sifat 寂寞 (merasa kesepian); sedangkan 别难过了 dipakai untuk menghibur orang yang sedih.',
            },
          },
        ],
        focusWords: ['感到', '难过', '所以'],
      },
    ),
    fill(
      'l3',
      'jiaocheng',
      3,
      '用“就”或“才”填空',
      ['就', '才'],
      [
        '1. 她每天都六点半起床，今天六点钟{{1}}起床了。',
        '2. 八点钟上课，他八点半{{2}}来。',
        '3. 电影七点半{{3}}开演呢，你怎么现在{{4}}来了？',
        '4. 昨天晚上我十二点{{5}}睡觉。',
      ],
      ['就', '才', '才', '就', '才'],
      {
        pattern: 'Time + 就 + Verb (+ 了) [earlier/faster than expected] | Time + 才 + Verb [later/slower, NO 了]',
        grammarTag: '就 / 才',
        whyRight: {
          en: '就 signals the action happened EARLIER or MORE EASILY than expected (6:00 vs usual 6:30 -> 就起床了; arriving early -> 现在就来了). 才 signals LATER than expected (8:30 for 8:00 class -> 才来; 7:30 start -> 才开演; midnight -> 才睡觉), and 才 rejects sentence-final 了.',
          id: '就 menandakan aksi terjadi LEBIH AWAL/CEPAT dari perkiraan (jam 6 vs biasa 6.30 -> 就起床了; datang lebih awal -> 现在就来了). 才 menandakan LEBIH LAMBAT/BARU SAJA (kelas jam 8 datang 8.30 -> 才来; baru mulai jam 7.30 -> 才开演; baru tidur jam 12 malam -> 才睡觉) dan tidak memakai 了 di akhir kalimat.',
        },
        distractorNotes: [
          {
            option: '才 on 六点钟__起床了',
            whyWrong: {
              en: 'First, 6:00 is earlier than 6:30; second, the sentence ends with 了, which conflicts with 才.',
              id: 'Pertama, jam 6 lebih awal dari 6.30; kedua, kalimat ini diakhiri 了 yang tidak cocok dengan 才.',
            },
          },
          {
            option: '就 on 七点半__开演呢',
            whyWrong: {
              en: 'The speaker complains the friend came too early ("it doesn’t even start until 7:30!"), which requires 才.',
              id: 'Pembicara merasa temannya datang terlalu cepat ("filmnya baru mulai jam 7.30!"), jadi klausa jadwal pakai 才.',
            },
          },
        ],
        focusWords: ['就', '才'],
        confusionPairs: [['就', '才']],
      },
    ),
    fill(
      'l4',
      'jiaocheng',
      4,
      '选词填空 · 结果补语',
      ['懂', '开', '成', '好', '熟', '错', '关', '道', '上'],
      [
        '1. 这几{{1}}题比较难，我不知道做对没做对。',
        '2. 外边风很大，{{2}}上窗户吧。',
        '3. 打{{3}}电脑，看看电视剧吧。',
        '4. 对不起，我看{{4}}时间了，所以来晚了。',
        '5. 这次我没考{{5}}。',
        '6. 你说得太快，我没听{{6}}。',
        '7. 请大家合{{7}}书，现在听写生词。',
        '8. 糟糕，这个是“找”字，我写{{8}}“我”了。',
      ],
      ['道', '关', '开', '错', '好', '懂', '上', '成'],
      {
        pattern: 'Verb + Resultative Complement (做对 / 关上 / 打开 / 看错 / 考好 / 听懂 / 合上 / 写成)',
        grammarTag: '结果补语 (Result Complements)',
        whyRight: {
          en: 'Result complements specify the outcome of the verb: 关上/合上 (close shut), 打开 (turn/open on), 看错 (misread), 考好 (do well on exam), 听懂 (understand by listening), 写成 (write into a different character). Measure word 道 counts questions (这几道题).',
          id: 'Pelengkap hasil menjelaskan hasil tindakan: 关上/合上 (tutup rapat), 打开 (nyalakan/buka), 看错 (salah lihat), 考好 (ujian bagus), 听懂 (dengar sampai paham), 写成 (salah tulis berubah jadi karakter lain). Kata satuan soal adalah 道 (这几道题).',
        },
        distractorNotes: [
          {
            option: '写错“我”了 instead of 写成“我”了',
            whyWrong: {
              en: 'When an object follows showing what X transformed into ("wrote it as 我"), Mandarin uses V + 成 + Result, not V + 错 + Object.',
              id: 'Kalau ada objek yang menunjukkan berubah menjadi apa ("tertulis jadi 我"), pakai V + 成 + hasil, bukan V + 错.',
            },
          },
        ],
        focusWords: ['懂', '成', '错', '道'],
        confusionPairs: [['错', '成']],
      },
    ),
    fill(
      'l6',
      'jiaocheng',
      6,
      '选词填空',
      ['气温', '预报', '最', '名曲', '流行', '迷', '增加', '暖和'],
      [
        '1. 他{{1}}喜欢看足球比赛。',
        '2. 我们国家的冬天比这儿{{2}}。',
        '3. 我们班又{{3}}了两个新同学。',
        '4. 他是一个足球{{4}}。',
        '5. 我喜欢{{5}}歌曲。',
        '6. 这是一首世界{{6}}。',
        '7. 今天最高{{7}}是零下一度。',
        '8. 天气{{8}}说得不一定对。',
      ],
      ['最', '暖和', '增加', '迷', '流行', '名曲', '气温', '预报'],
      {
        pattern: 'A 比 B + Adj (comparison) | Noun/Verb Collocations (天气预报 / 足球迷 / 最高气温)',
        grammarTag: '比较句与气候词汇',
        whyRight: {
          en: 'Uses Lesson 6 weather & music vocabulary accurately: 比这儿暖和 (warmer than here), 足球迷 (soccer fan), 流行歌曲 (pop songs), 世界名曲 (world masterpiece), 最高气温 (highest temperature), 天气预报 (weather forecast).',
          id: 'Memakai kosakata cuaca dan musik Pelajaran 6: 比这儿暖和 (lebih hangat dari sini), 足球迷 (penggemar bola), 流行歌曲 (lagu pop), 世界名曲 (karya klasik dunia), 最高气温 (suhu tertinggi), 天气预报 (prakiraan cuaca).',
        },
        distractorNotes: [
          {
            option: '预报 vs 气温',
            whyWrong: {
              en: '最高气温 takes temperatures like 零下一度, whereas 天气预报 is the forecast that "says" (说) what the weather will be.',
              id: '最高气温 dipasangkan dengan angka suhu (零下一度), sedangkan 天气预报 adalah prakiraan yang "mengatakan" (说) cuaca.',
            },
          },
        ],
        focusWords: ['暖和', '气温', '预报'],
      },
    ),
    fill(
      'l7',
      'jiaocheng',
      7,
      '选词填空',
      ['博物馆', '刮', '一样', '秋天', '开放', '而且', '产生', '研究', '只是'],
      [
        '1. 北京一年有四个季节：春天、夏天、{{1}}、冬天。',
        '2. 我们国家的气候跟这儿不{{2}}。',
        '3. {{3}}了一夜大风，天气一下变冷了。',
        '4. 你打算{{4}}这个城市的历史吗？',
        '5. 我{{5}}认识她，对她还不太了解。',
        '6. 最近我对中国画{{6}}了兴趣。',
        '7. 我周末常去{{7}}参观。',
        '8. 改革{{8}}以后，中国的变化很大。',
        '9. 这儿的冬天不但很冷，{{9}}还常常刮风。',
      ],
      ['秋天', '一样', '刮', '研究', '只是', '产生', '博物馆', '开放', '而且'],
      {
        pattern: 'A 跟 B (不)一样 | 不但……而且…… | 对……产生兴趣',
        grammarTag: '跟…一样 / 不但…而且',
        whyRight: {
          en: 'Covers Lesson 7 structures: 跟这儿不一样 (different from here), 刮了一夜大风 (blew strong wind all night), 产生了兴趣 (developed interest), 不但…而且… (not only…but also).',
          id: 'Mencakup struktur Pelajaran 7: 跟这儿不一样 (tidak sama dengan sini), 刮了一夜大风 (bertiup angin kencang semalaman), 产生了兴趣 (timbul minat), 不但…而且… (tidak hanya…tetapi juga).',
        },
        distractorNotes: [
          {
            option: '只是 vs 而且',
            whyWrong: {
              en: '只是 ("merely/just") limits a statement (只是认识，不太了解), while 而且 pairs with 不但 to add a stronger point.',
              id: '只是 ("cuma") membatasi pernyataan, sedangkan 而且 berpasangan dengan 不但 untuk menambah poin yang lebih kuat.',
            },
          },
        ],
        focusWords: ['一样', '而且', '只是'],
      },
    ),
    fill(
      'l8',
      'jiaocheng',
      8,
      '选词填空',
      ['该', '着呢', '结婚', '有名', '真', '要', '爱', '迟到', '发财', '尤其'],
      [
        '1. 这里的秋天{{1}}好，不冷也不热。',
        '2. 我{{2}}滑冰，也{{3}}滑雪。',
        '3. 我们家乡是{{4}}的风景区，{{5}}是夏天，人特别多。',
        '4. 很多人家都靠经营旅馆{{6}}了。',
        '5. 下个月我姐姐就要{{7}}了。',
        '6. 快走吧，{{8}}迟到了。',
        '7. 对不起，我{{9}}了。',
        '8. 别着急，天还早{{10}}。',
      ],
      ['真', '爱', '爱', '有名', '尤其', '发财', '结婚', '要', '迟到', '着呢'],
      {
        pattern: '要/就要/快要 + V + 了 (imminent) | Adj + 着呢 (very much so)',
        grammarTag: '快要…了 / 着呢',
        whyRight: {
          en: '要…了 marks an imminent event (快走吧，要迟到了; 下个月就要结婚了); Adj + 着呢 emphasizes high degree ("still very early" -> 早着呢).',
          id: '要…了 menandai kejadian yang segera terjadi (要迟到了, 就要结婚了); Adj + 着呢 menekankan tingkat tinggi ("masih pagi banget" -> 早着呢).',
        },
        distractorNotes: [
          {
            option: 'Using 该 in 快走吧，__迟到了',
            whyWrong: {
              en: '该…了 means "it’s time to / ought to", whereas 要迟到了 warns that being late is about to happen.',
              id: '该…了 berarti "sudah waktunya", sedangkan 要迟到了 memperingatkan bahwa keterlambatan hampir terjadi.',
            },
          },
        ],
        focusWords: ['要', '着呢', '尤其'],
      },
    ),
    fill(
      'l9',
      'jiaocheng',
      9,
      '选词填空',
      ['准时', '取', '麻烦', '参观', '顺便', '清楚', '要求', '大约'],
      [
        '1. {{1}}你给他带一件衣服去，好吗？',
        '2. 我进城去看展览，{{2}}买了这本画册来。',
        '3. 今天{{3}}展览的人真多。',
        '4. 是上午去还是下午去，我没听{{4}}。',
        '5. 她回宿舍去{{5}}手机了。',
        '6. 老师每天七点五十{{6}}到教室。',
        '7. 老师{{7}}我们多听、多读、多说、多写。',
        '8. 今天的作业我{{8}}做了两个小时才做完。',
      ],
      ['麻烦', '顺便', '参观', '清楚', '取', '准时', '要求', '大约'],
      {
        pattern: '麻烦你 + V | 顺便 + V (conveniently on the way) | V + 清楚 (complement of clarity)',
        grammarTag: '顺便 / 结果补语清楚',
        whyRight: {
          en: '顺便 indicates doing a side errand while already going somewhere; 听清楚 uses 清楚 as a result complement ("hear clearly"); 准时 means punctual.',
          id: '顺便 berarti sekalian melakukan sesuatu sambil jalan; 听清楚 memakai 清楚 sebagai pelengkap hasil ("dengar dengan jelas"); 准时 berarti tepat waktu.',
        },
        distractorNotes: [
          {
            option: 'Using 准时 in __做了两个小时',
            whyWrong: {
              en: 'Approximately two hours requires 大约 ("about"), not 准时 ("on time").',
              id: '"Sekitar dua jam" membutuhkan 大约 ("kira-kira"), bukan 准时 ("tepat waktu").',
            },
          },
        ],
        focusWords: ['顺便', '清楚', '准时'],
      },
    ),
    fill(
      'l10',
      'jiaocheng',
      10,
      '选词填空',
      ['治', '烤鸭', '感冒', '极了', '钢琴', '中餐', '中药'],
      [
        '1. 她听过这首{{1}}协奏曲。',
        '2. 我从来没有吃过{{2}}。',
        '3. 他喜欢吃北京{{3}}。',
        '4. 按摩能{{4}}好你的病。',
        '5. 他演奏得好{{5}}。',
        '6. 来中国以后我得过一次{{6}}。',
      ],
      ['钢琴', '中餐', '烤鸭', '治', '极了', '感冒'],
      {
        pattern: '从来没(有) + V + 过 | V + 过 + 一次/几回 (动量补语) | Adj + 极了',
        grammarTag: 'Verb + 过 / 极了',
        whyRight: {
          en: 'Pairs 过 experiential aspect (从来没有吃过中餐, 得过一次感冒) with Lesson 10 vocabulary and 好极了 ("extremely good").',
          id: 'Memadukan aspek pengalaman 过 (从来没有吃过中餐, 得过一次感冒) dengan kosakata Pelajaran 10 dan 好极了 ("bagus sekali").',
        },
        distractorNotes: [
          {
            option: 'Swapping 中餐 and 烤鸭',
            whyWrong: {
              en: 'Line 3 explicitly specifies 北京__, which is the fixed collocation 北京烤鸭.',
              id: 'Kalimat 3 menyebut 北京__, yang kolokasi tetapnya adalah 北京烤鸭.',
            },
          },
        ],
        focusWords: ['治', '极了', '感冒'],
      },
    ),
    fill(
      'l11',
      'jiaocheng',
      11,
      '选词填空',
      ['陪', '组织', '希望', '收集', '研究', '老板', '利用', '需要'],
      [
        '1. 丹尼丝{{1}}的是中国的孔子。',
        '2. 她常{{2}}暑假去一家公司打工。',
        '3. 我这次来是为写论文{{3}}资料的。',
        '4. 学好一门外语{{4}}时间。',
        '5. 他现在已经是一家大公司的{{5}}了。',
        '6. 我{{6}}毕业以后能当翻译。',
      ],
      ['研究', '利用', '收集', '需要', '老板', '希望'],
      {
        pattern: '是……的 (cleft focus) | 为 + Purpose + V | 利用 + Time + V',
        grammarTag: '是…的 / 为…',
        whyRight: {
          en: '研究的是孔子 uses 是…的 to emphasize the research subject; 利用暑假 uses summer break as a resource; 收集资料 = collect materials.',
          id: '研究的是孔子 memakai pola fokus 是…的; 利用暑假 berarti memanfaatkan liburan musim panas; 收集资料 = mengumpulkan bahan.',
        },
        distractorNotes: [
          {
            option: 'Using 组织 for __资料',
            whyWrong: {
              en: 'You organize (组织) activities/people, whereas you collect (收集) materials/data (资料).',
              id: '组织 dipakai untuk kegiatan/orang, sedangkan untuk bahan/data (资料) pakai 收集.',
            },
          },
        ],
        focusWords: ['研究', '利用', '希望'],
      },
    ),
    fill(
      'l12',
      'jiaocheng',
      12,
      '选词填空',
      ['丢', '半天', '放', '给', '京剧', '迷', '好'],
      [
        '1. 我的护照你{{1}}在什么地方了？',
        '2. 你的签证办{{2}}了没有？',
        '3. 那本书我一看完就还{{3}}你了。',
        '4. 我找了{{4}}才找到。',
        '5. 我们老师中有不少京剧{{5}}。',
        '6. 你怎么了？最近总是{{6}}三落四的。',
      ],
      ['放', '好', '给', '半天', '迷', '丢'],
      {
        pattern: 'V + 在 (location) / V + 给 (recipient) / V + 好 (ready) | 丢三落四',
        grammarTag: '结果补语 在 / 给 / 好',
        whyRight: {
          en: 'Lesson 12 covers post-verbal complements: 放在什么地方 (placed where), 办好了没有 (finished properly?), 还给你 (returned to you), 找了半天 (searched ages), 丢三落四 (forgetful idiom).',
          id: 'Pelajaran 12 melatih pelengkap hasil: 放在 (diletakkan di), 办好 (selesai diurus), 还给 (dikembalikan ke), 找了半天 (cari lama), dan idiom 丢三落四 (sering lupa/ceroboh).',
        },
        distractorNotes: [
          {
            option: 'Using 放 without 在 or mixing 好/给',
            whyWrong: {
              en: '还给 marks transfer back to someone (你); 办好 marks completion ready for use.',
              id: '还给 menandakan dikembalikan kepada penerima (你); 办好 menandakan prosesnya sudah beres siap pakai.',
            },
          },
        ],
        focusWords: ['放', '好', '给'],
      },
    ),
    choice(
      'q1',
      'jiaocheng',
      1,
      '你去哪儿？',
      ['我去图书馆了。', '我去图书馆。'],
      '我去图书馆。',
      '还没去，不加“了”。',
      {
        pattern: 'Action in progress / intended destination: Subject + 去 + Place (no 了)',
        grammarTag: '语气助词“了”',
        whyRight: {
          en: 'When someone asks where you are heading right now (你去哪儿？), the trip is not completed yet, so omit 了: 我去图书馆。',
          id: 'Saat ditanya "mau ke mana?" (你去哪儿？), kepergiannya belum selesai, jadi jangan pakai 了: 我去图书馆。',
        },
        distractorNotes: [
          {
            option: '我去图书馆了。',
            whyWrong: {
              en: 'Adding 了 after 图书馆 would imply you already went (or changed situation), which answers 你去哪儿了？ instead.',
              id: 'Menambah 了 berarti sudah pergi ke sana; itu jawaban untuk 你去哪儿了？ bukan 你去哪儿？.',
            },
          },
        ],
        focusWords: ['了'],
        confusionPairs: [['了', '过']],
      },
    ),
    choice(
      'q2',
      'jiaocheng',
      1,
      '你买词典了没有？',
      ['我不买词典。', '我没买词典。'],
      '我没买词典。',
      '问过去，否定用“没”。',
      {
        pattern: 'Past V-了没有？ -> 没(有) + V',
        grammarTag: '不 / 没有',
        whyRight: {
          en: 'The question asks whether you bought the dictionary (了没有). Negating a completed/past action requires 没(有).',
          id: 'Pertanyaan memakai 了没有 menanyakan apakah sudah membeli kamus. Jawaban negatifnya wajib memakai 没(有).',
        },
        distractorNotes: [
          {
            option: '我不买词典。',
            whyWrong: {
              en: '不买 expresses refusal or intention not to buy ("I’m not going to buy"), not whether it happened.',
              id: '我不买 berarti "saya tidak mau/tidak akan beli", bukan menyatakan belum membeli.',
            },
          },
        ],
        focusWords: ['没', '不'],
        confusionPairs: [['不', '没有']],
      },
    ),
    choice(
      'q3',
      'jiaocheng',
      1,
      '今天晚上谁来？',
      ['张东来。', '张东来了。'],
      '张东来。',
      '晚上还没到，不用“了”。',
      {
        pattern: 'Future time (今天晚上) + Verb (no completed 了)',
        grammarTag: '语气助词“了”',
        whyRight: {
          en: 'Tonight has not happened yet, so the arrival is future/planned: 张东来。',
          id: 'Nanti malam belum tiba, sehingga kedatangan belum selesai terjadi: pakai 张东来。',
        },
        distractorNotes: [
          {
            option: '张东来了。',
            whyWrong: {
              en: '张东来了 means Zhang Dong has already arrived.',
              id: '张东来了 artinya Zhang Dong sudah datang sekarang.',
            },
          },
        ],
        focusWords: ['了'],
      },
    ),
    choice(
      'q4',
      'jiaocheng',
      1,
      '上午你上没上课？',
      ['不上课。', '没上课。'],
      '没上课。',
      '“上没上课”问的是已经上了没有。',
      {
        pattern: 'V + 没 + V (past yes/no question) -> 没 + V',
        grammarTag: '不 / 没有',
        whyRight: {
          en: '上没上课 uses 没 to ask about an event in the morning (past); the negative reply is 没上课.',
          id: 'Bentuk tanya 上没上课 menanyakan kejadian tadi pagi (lampau); jawaban negatifnya pakai 没上课.',
        },
        distractorNotes: [
          {
            option: '不上课。',
            whyWrong: {
              en: '不上课 answers 上不上课 (whether one habitually or plans to attend class), not 上没上课.',
              id: '不上课 menjawab 上不上课 (rencana/kebiasaan), bukan 上没上课.',
            },
          },
        ],
        focusWords: ['没', '不'],
        confusionPairs: [['不', '没有']],
      },
    ),
    choice(
      'q5',
      'jiaocheng',
      1,
      '晚上你看不看足球赛？',
      ['看了。', '看。'],
      '看。',
      '“看不看”问的是打算。',
      {
        pattern: 'V + 不 + V (future intention/habit) -> V (no 了)',
        grammarTag: '不 / 没有',
        whyRight: {
          en: '看不看 asks about tonight’s plan/intention, so answer simply with 看 (bare verb, no 了).',
          id: 'Tanya 看不看 menanyakan rencana nanti malam, jadi jawabannya cukup kata kerja polos 看 tanpa 了.',
        },
        distractorNotes: [
          {
            option: '看了。',
            whyWrong: {
              en: '看了 means you already watched it, contradicting 晚上 (tonight).',
              id: '看了 berarti sudah menonton, bertentangan dengan waktu nanti malam (晚上).',
            },
          },
        ],
        focusWords: ['看', '了'],
      },
    ),
    choice(
      'q6',
      'jiaocheng',
      1,
      '你去没去医院？',
      ['去了。', '去。'],
      '去了。',
      '“去没去”问过去。',
      {
        pattern: 'V + 没 + V (past event) -> V + 了',
        grammarTag: '语气助词“了”',
        whyRight: {
          en: '去没去 asks whether the past action occurred; affirmative answer adds 了: 去了.',
          id: '去没去 menanyakan apakah peristiwa lampau sudah dilakukan; jawaban "ya" memakai 了: 去了.',
        },
        distractorNotes: [
          {
            option: '去。',
            whyWrong: {
              en: 'Bare 去 answers 你去不去？ (will you go?), not 你去没去？.',
              id: '去 tanpa 了 menjawab 你去不去？ (mau pergi?), bukan 你去没去？.',
            },
          },
        ],
        focusWords: ['去', '了'],
      },
    ),
    choice(
      'q7',
      'jiaocheng',
      5,
      '我给你（  ）点儿药，一天吃三次，一次两片，多喝水。',
      ['开', '拉', '喝', '吃'],
      '开',
      '大夫开药。第5课。',
      {
        pattern: '大夫给病人开药 (prescribe medicine)',
        grammarTag: '动词搭配 (Collocations)',
        whyRight: {
          en: 'In Mandarin, a doctor "prescribes" medicine with 开药 (literally open a prescription).',
          id: 'Dalam bahasa Mandarin, dokter meresepkan obat memakai kata kerja 开药.',
        },
        distractorNotes: [
          {
            option: '吃 / 喝',
            whyWrong: {
              en: 'The patient 吃药 (takes medicine), whereas the doctor says 我给你开点儿药 ("I’ll prescribe some medicine for you").',
              id: 'Pasien yang 吃药 (minum obat), sedangkan dokter yang berkata 我给你开点儿药 ("saya resepkan obat untukmu").',
            },
          },
          {
            option: '拉',
            whyWrong: {
              en: '拉 pairs with 肚子 (have diarrhea), not prescribing medicine.',
              id: '拉 dipakai untuk 拉肚子 (diare), bukan meresepkan obat.',
            },
          },
        ],
        focusWords: ['开'],
      },
    ),

    // --- Jiaocheng Part 2-2 (Lessons 13–25) Deep Expansion ---
    fill(
      'jc-l13-14-comp',
      'jiaocheng',
      13,
      '选词填空 · 第13–14课 补语与被动',
      ['摔坏', '差点儿', '拔下来', '拿下来', '删', '放大', '虚'],
      [
        '1. 不好意思，我的眼镜儿掉在地上{{1}}了。',
        '2. 路上堵车，我今天上午{{2}}迟到。',
        '3. 这张照片照{{3}}了，一点儿也不清楚，都{{4}}了吧。',
        '4. 锁好自行车以后，别忘了把钥匙{{5}}。',
        '5. 我从书架上{{6}}一本词典查生词。',
      ],
      ['摔坏', '差点儿', '虚', '删', '拔下来', '拿下来'],
      {
        pattern: 'V + 结果/复合趋向补语 (摔坏 / 拔下来 / 拿下来) | 差点儿 + V',
        grammarTag: '复合趋向补语与结果补语',
        whyRight: {
          en: 'Lesson 13–14 drills result & compound directional complements: 摔坏 (dropped and broken), 拔下来 (pull key out and down), 拿下来 (take down from shelf), plus 差点儿 (almost) and photography verbs 照虚/删.',
          id: 'Pelajaran 13–14 melatih pelengkap hasil & arah majemuk: 摔坏 (jatuh rusak), 拔下来 (cabut kunci keluar), 拿下来 (ambil turun dari rak), serta 差点儿 (hampir saja) dan kosakata foto 照虚/删.',
        },
        distractorNotes: [
          {
            option: 'Using 拔下来 on a book on a shelf',
            whyWrong: {
              en: '拔 means pull out something inserted (like a key from a lock); books on a shelf use 拿下来.',
              id: '拔 berarti mencabut sesuatu yang tertancap (kunci), sedangkan mengambil buku dari rak memakai 拿下来.',
            },
          },
        ],
        focusWords: ['摔坏', '差点儿', '下来'],
      },
    ),
    choice(
      'jc-l15-zhe',
      'jiaocheng',
      15,
      '墙上贴（  ）一个大红“福”字，会议厅的门也开（  ）呢。',
      ['着 / 着', '了 / 过', '过 / 着', '着 / 了'],
      '着 / 着',
      '表示动作完成后留下的持续状态，用“动词 + 着”。第15课。',
      {
        pattern: 'Location + V + 着 + Noun | Subject + V + 着 + 呢 (continuing state)',
        grammarTag: '了 / 着 / 过',
        whyRight: {
          en: 'Both clauses describe an ongoing resulting state visible right now (stuck on the wall; door standing open), which requires 贴着 and 开着呢.',
          id: 'Kedua klausa menggambarkan kondisi tetap yang masih berlangsung sekarang (tertempel di dinding; pintu dalam keadaan terbuka), jadi keduanya memakai 贴着 dan 开着呢.',
        },
        distractorNotes: [
          {
            option: '了 / 过',
            whyWrong: {
              en: '过 marks a past experience that is no longer continuing; 了 marks a completed change rather than a static ongoing scene.',
              id: '过 menyatakan pengalaman masa lalu yang sudah lewat, sedangkan 了 menandai kejadian selesai, bukan kondisi statis yang sedang bertahan.',
            },
          },
        ],
        focusWords: ['着', '了', '过'],
        confusionPairs: [['了', '着'], ['着', '过']],
      },
    ),
    order(
      'jc-l14-order',
      'jiaocheng',
      14,
      ['拿出来', '我从包里', '送给了朋友', '把那本画册'],
      ['我从包里', '把那本画册', '拿出来', '送给了朋友'],
      {
        pattern: 'Subject + 从… + 把 + Definite Object + V + Compound Directional Complement',
        grammarTag: '把字句与趋向补语',
        whyRight: {
          en: 'Place adverbial 从包里 precedes 把 + specific object 那本画册, followed by verb + compound directional complement 拿出来, then the next action 送给了朋友.',
          id: 'Keterangan tempat 从包里 ditaruh sebelum 把 + objek spesifik 那本画册, lalu kata kerja + pelengkap arah 拿出来, baru aksi berikutnya 送给了朋友.',
        },
        distractorNotes: [
          {
            option: '我把包里拿出来那本画册',
            whyWrong: {
              en: 'The thing pulled out is 那本画册 (so 把 takes 那本画册), while 从包里 is the starting location before the verb.',
              id: 'Yang dikeluarkan adalah 那本画册 (objek dari 把), sedangkan 从包里 adalah lokasi asal sebelum kata kerja.',
            },
          },
        ],
        focusWords: ['把', '出来'],
      },
      {
        en: 'Place where you took it from, then 把 + what you took, then the directional verb.',
        id: 'Susun: asal tempat (从包里) → 把 + benda → kata kerja arah (拿出来) → hasil akhir.',
      },
    ),
    errorFix(
      'jc-l17-ba-error',
      'jiaocheng',
      18,
      '我把护照没放在桌子上，放在包里了。',
      '把字句的否定位置（“没/不”必须在“把”前）',
      [
        '我没把护照放在桌子上，放在包里了。',
        '我把护照放在没桌子上，放在包里了。',
        '我把没护照放在桌子上，放在包里了。',
        '我把护照不放在桌子上，放在包里了。',
      ],
      '我没把护照放在桌子上，放在包里了。',
      {
        pattern: 'Subject + 没(有)/不/能愿动词 + 把 + Object + V + Complement',
        grammarTag: '把字句',
        whyRight: {
          en: 'In a 把 sentence, negatives (没/不) and modal verbs (能/想/应该) MUST sit BEFORE 把, never between 把 and the verb.',
          id: 'Pada kalimat 把, kata sangkal (没/不) dan kata bantu (能/想/应该) WAJIB berada SEBELUM 把, bukan di belakang 把.',
        },
        distractorNotes: [
          {
            option: '我把护照不放在桌子上',
            whyWrong: {
              en: 'Negation 不/没 placed after 把 + object violates Mandarin word order.',
              id: 'Menaruh 不 atau 没 setelah objek 把 melanggar tata urut kalimat 把.',
            },
          },
          {
            option: '我把没护照…',
            whyWrong: {
              en: '没 cannot split 把 from its object 护照.',
              id: '没 tidak boleh memisahkan 把 dan objeknya 护照.',
            },
          },
        ],
        focusWords: ['把', '没', '放'],
        confusionPairs: [['把', '被']],
      },
    ),
    choice(
      'jc-l19-bei',
      'jiaocheng',
      19,
      '真倒霉！我的新自行车（  ）人骑走了，钱包也（  ）小偷偷了。',
      ['被 / 被', '把 / 把', '把 / 被', '给 / 把'],
      '被 / 被',
      '主语“自行车”“钱包”是动作的承受者（被动），用“被”字句。第19课。',
      {
        pattern: 'Patient (Subject) + 被 + (Agent) + Verb + Result/了',
        grammarTag: '把 / 被',
        whyRight: {
          en: 'The subjects 我的新自行车 and 钱包 are the targets acted upon (passive victims of unfortunate events), so both require 被 (someone rode it away / stolen by a thief).',
          id: 'Subjek 我的新自行车 dan 钱包 adalah pihak yang dikenai tindakan (kalimat pasif/musibah), sehingga keduanya wajib memakai 被.',
        },
        distractorNotes: [
          {
            option: '把 / 把',
            whyWrong: {
              en: '把 requires the subject to be the DOER (agent) acting on the object after 把. A bicycle cannot actively ride a person.',
              id: '把 menuntut subjek sebagai PELAKU; sepeda dan dompet di sini adalah korban/sasaran aksi, bukan pelaku.',
            },
          },
        ],
        focusWords: ['把', '被'],
        confusionPairs: [['把', '被']],
      },
    ),
    fill(
      'jc-l20-21-pot',
      'jiaocheng',
      20,
      '选词填空 · 可能补语（第20–21课）',
      ['看得懂', '听不懂', '爬得上去', '坐不下', '吃不了'],
      [
        '1. 这本中文小说不太难，我{{1}}，但是老师讲得太快，我{{2}}。',
        '2. 这座山这么高，你{{3}}吗？',
        '3. 房间太小了，二十个人{{4}}。',
        '4. 你点这么多菜，咱们两个人肯定{{5}}。',
      ],
      ['看得懂', '听不懂', '爬得上去', '坐不下', '吃不了'],
      {
        pattern: 'V + 得/不 + Complement (可能补语: 懂 / 上去 / 下 / 了 liǎo)',
        grammarTag: '可能补语',
        whyRight: {
          en: 'Potential complements express whether a result is achievable: 看得懂 (can understand by reading), 听不懂 (cannot catch by listening), 爬得上去 (able to climb up), 坐不下 (not enough space to seat), 吃不了 (unable to finish eating).',
          id: 'Pelengkap kemungkinan menyatakan bisa/tidaknya suatu hasil dicapai: 看得懂 (bisa paham bacaan), 听不懂 (tidak bisa paham dengar), 爬得上去 (sanggup memanjat naik), 坐不下 (tidak muat duduk), 吃不了 (tidak sanggup menghabiskan).',
        },
        distractorNotes: [
          {
            option: 'Using 坐不了 vs 坐不下',
            whyWrong: {
              en: '下 focuses on spatial capacity ("fit inside a room/car"), whereas 了 (liǎo) expresses finishing/ability to carry out an action like eating all the dishes (吃不了).',
              id: '下 menyatakan kapasitas ruang muat (坐不下), sedangkan 了 (liǎo) menyatakan sanggup menyelesaikan aksi (吃不了).',
            },
          },
        ],
        focusWords: ['看得懂', '听不懂', '爬得上去', '坐不下', '吃不了'],
      },
    ),
    choice(
      'jc-l21-22-cond',
      'jiaocheng',
      22,
      '（  ）坚持每天用中文跟朋友交流，（  ）能真正提高口语水平；其实（  ）每天练习十分钟，半年后（  ）会有很大进步。',
      ['只有……才…… / 只要……就……', '只要……就…… / 只有……才……', '虽然……但是…… / 不但……而且……', '既然……就…… / 连……都……'],
      '只有……才…… / 只要……就……',
      '“只有……才……”强调唯一必要条件，“只要……就……”强调充分条件。第21–22课。',
      {
        pattern: '只有 A 才 B (only if A, then B) vs 只要 A 就 B (as long as A, then B)',
        grammarTag: '只有…才 / 只要…就',
        whyRight: {
          en: 'The first clause states the sole essential condition for true fluency (只有…才能真正提高); the second states an easy sufficient condition ("just 10 min a day is enough" -> 只要…就会).',
          id: 'Klausa pertama menekankan syarat mutlak satu-satunya untuk benar-benar meningkat (只有…才能), sedangkan klausa kedua menekankan syarat cukup ("asal 10 menit sehari saja sudah pasti maju" -> 只要…就会).',
        },
        distractorNotes: [
          {
            option: 'Swapping 只要…就 and 只有…才',
            whyWrong: {
              en: '只要…就 pairs 只要 with 就 (never 才), and 只有…才 pairs 只有 with 才.',
              id: 'Pasangan tetapnya adalah 只有…才 dan 只要…就; 只要 tidak berpasangan dengan 才.',
            },
          },
        ],
        focusWords: ['只有', '只要', '才', '就'],
        confusionPairs: [['只有', '只要'], ['就', '才']],
      },
    ),
    choice(
      'jc-l24-mw',
      'jiaocheng',
      24,
      '她戴着一（  ）新眼镜，手里提着一（  ）皮鞋，旁边站着一（  ）来北京旅游的老夫妻。',
      ['副 / 双 / 对', '对 / 副 / 双', '双 / 对 / 副', '把 / 张 / 件'],
      '副 / 双 / 对',
      '眼镜用“副”，鞋子成双使用用“双”，夫妻用“对”。第13、24课。',
      {
        pattern: '一副眼镜 | 一双鞋/筷子 | 一对夫妻/耳环',
        grammarTag: '量词辨析 (对 / 双 / 副)',
        whyRight: {
          en: '副 is used for glasses/gloves (一副眼镜); 双 for symmetric pairs worn or used together (一双皮鞋); 对 for matched couples/pairs (一对老夫妻).',
          id: '副 untuk kacamata/sarung tangan (一副眼镜); 双 untuk sepasang benda simetris seperti sepatu/sumpit (一双皮鞋); 对 untuk pasangan serasi/suami-istri (一对老夫妻).',
        },
        distractorNotes: [
          {
            option: '一对眼镜 / 一副皮鞋',
            whyWrong: {
              en: 'Glasses are one connected frame (副), never 对; shoes are always 双, never 副.',
              id: 'Kacamata berbentuk satu set bingkai (副), bukan 对; sepatu selalu memakai 双, bukan 副.',
            },
          },
          {
            option: '把 / 张 / 件',
            whyWrong: {
              en: '把 is for handled tools/chairs, 张 for flat sheets/tables, 件 for clothes/matters.',
              id: '把 untuk benda bergagang/kursi, 张 untuk lembaran/meja, 件 untuk baju/urusan.',
            },
          },
        ],
        focusWords: ['对', '双', '副'],
        confusionPairs: [['对', '双'], ['对', '副'], ['双', '副']],
      },
    ),
    order(
      'jc-l25-lian-order',
      'jiaocheng',
      25,
      ['也不会写', '这么简单的汉字', '他连', '怎么'],
      ['他连', '这么简单的汉字', '怎么', '也不会写'],
      {
        pattern: 'Subject + 连 + Extreme Object + (怎么) + 也/都 + Negated Verb',
        grammarTag: '连…也/都…',
        whyRight: {
          en: '连 introduces the highlighted extreme example (这么简单的汉字), and 也/都 MUST sit before the negated verb phrase (怎么也不会写 = "how come he doesn’t even know how to write…").',
          id: '连 mendahului objek yang ditegaskan (这么简单的汉字), dan 也/都 wajib muncul sebelum kata kerja negatif (怎么也不会写).',
        },
        distractorNotes: [
          {
            option: '怎么他连也不会写这么简单的汉字',
            whyWrong: {
              en: '连 must immediately precede the emphasized noun phrase 这么简单的汉字.',
              id: '连 harus langsung menempel di depan frasa benda yang ditegaskan (这么简单的汉字).',
            },
          },
        ],
        focusWords: ['连'],
      },
      {
        en: 'Start with 主语 + 连, then the surprisingly simple object, then 怎么 + 也 + verb.',
        id: 'Mulai dengan 他连, lanjut objeknya, lalu 怎么也不会写.',
      },
    ),
    reading(
      'jc-l24-read',
      'jiaocheng',
      24,
      '今天早上我在十字路口儿看见一对老夫妻，看样子腿脚不太好，过马路走得很慢。我赶紧过去扶着他们过了马路。老爷爷笑着对我说：“谢谢你，小伙子，多亏有你帮忙！”',
      '根据这段话，下面哪一项是对的？',
      [
        '“我”扶着那对老夫妻安全过了马路',
        '老夫妻跑得很快，不需要帮忙',
        '老夫妻找不到回家的路，去警察局问路',
        '“我”因为堵车差点儿迟到，没时间停下来',
      ],
      '“我”扶着那对老夫妻安全过了马路',
      {
        pattern: 'Reading inference from Lesson 24 (十字路口儿 / 扶 / 多亏)',
        grammarTag: '阅读理解 (Jiaocheng)',
        whyRight: {
          en: 'The passage states the elderly couple walked slowly due to weak legs, and the narrator hurried over and supported them across the street (赶紧过去扶着他们过了马路).',
          id: 'Teks menjelaskan pasangan lansia berjalan pelan karena kakinya kurang kuat, lalu tokoh "saya" segera menolong memapah mereka menyeberang jalan.',
        },
        distractorNotes: [
          {
            option: '老夫妻跑得很快',
            whyWrong: {
              en: 'Contradicts 腿脚不太好，走得很慢.',
              id: 'Bertentangan dengan 腿脚不太好，走得很慢 (jalannya pelan).',
            },
          },
          {
            option: '去警察局问路 / 没时间停下来',
            whyWrong: {
              en: 'The narrator actively stopped to help, and no police station visit happens in this passage.',
              id: 'Tokoh "saya" benar-benar berhenti menolong, dan tidak ada adegan bertanya ke kantor polisi di teks ini.',
            },
          },
        ],
        focusWords: ['十字路口儿', '夫妻', '腿脚'],
      },
    ),
  ]
}

/** HSK 4 Mock & Final Prep (Lessons 1–10 + core HSK 4 grammar, ordering, error spotting, reading). */
export function buildHsk4Exam(): ExamPart[] {
  return [
    fill(
      'hsk4-mw-bank',
      'hsk4a',
      5,
      '选词填空 · 常用量词（对 / 双 / 副 / 把 / 张 / 件 / 道）',
      ['副', '双', '对', '把', '张', '件', '道'],
      [
        '1. 刚买的那{{1}}皮鞋穿起来特别舒服。',
        '2. 王老师戴着一{{2}}黑边眼镜，看起来很幽默。',
        '3. 他们俩真是一{{3}}让人羡慕的好夫妻。',
        '4. 请把那{{4}}椅子搬过来，客人们快到了。',
        '5. 桌上放着几{{5}}火车票和一{{6}}厚毛衣。',
        '6. 这{{7}}数学题太难了，我算了两遍都没算出来。',
      ],
      ['双', '副', '对', '把', '张', '件', '道'],
      {
        pattern: '一双鞋 / 一副眼镜 / 一对夫妻 / 一把椅子 / 一张票 / 一件毛衣 / 一道题',
        grammarTag: '量词辨析 (对 / 双 / 副 / 把 / 张 / 件 / 道)',
        whyRight: {
          en: 'Each HSK 4 noun takes a specific classifier: 双 (symmetric shoes), 副 (glasses), 对 (couple), 把 (object with handle/chair), 张 (flat ticket), 件 (upper-body garment), 道 (problem/question).',
          id: 'Tiap kata benda HSK 4 memakai kata satuan khusus: 双 (sepatu), 副 (kacamata), 对 (pasangan suami-istri), 把 (kursi), 张 (tiket datar), 件 (baju/sweter), 道 (soal).',
        },
        distractorNotes: [
          {
            option: '对 vs 双 vs 副',
            whyWrong: {
              en: 'Shoes always take 双, glasses take 副, and human couples take 对.',
              id: 'Sepatu selalu pakai 双, kacamata pakai 副, dan pasangan suami-istri pakai 对.',
            },
          },
          {
            option: '张 vs 件',
            whyWrong: {
              en: '张 is for flat paper items like tickets (票); 件 is for tops/sweaters (毛衣).',
              id: '张 untuk benda datar seperti tiket (票); 件 untuk pakaian atas seperti sweter (毛衣).',
            },
          },
        ],
        focusWords: ['对', '双', '副', '把', '张', '件', '道'],
        confusionPairs: [['对', '双'], ['对', '副'], ['双', '副']],
      },
    ),
    fill(
      'hsk4-conj-bank',
      'hsk4a',
      8,
      '选词填空 · 关联词与副词（HSK 4 第1–10课）',
      ['不仅', '尽管', '不管', '既然', '只要', '甚至', '因此', '难道'],
      [
        '1. 他{{1}}足球踢得好，而且性格也很幽默。',
        '2. {{2}}工作再忙，他每天晚上也坚持看半小时书。',
        '3. {{3}}我们认识的时间不长，但我从来没这么快乐过。',
        '4. {{4}}你已经决定了，那我们就按照你的计划办吧。',
        '5. {{5}}认真准备，面试的时候就不会那么紧张。',
        '6. 这篇文章写得非常深入，{{6}}连专业老师都称赞不已。',
        '7. 道路正在修，{{7}}今天大家最好坐地铁上班。',
        '8. 这么简单的道理，{{8}}你还不懂吗？',
      ],
      ['不仅', '不管', '尽管', '既然', '只要', '甚至', '因此', '难道'],
      {
        pattern: '不仅…而且 | 不管…也/都 | 尽管…但 | 既然…就 | 只要…就 | 甚至 | 因此 | 难道',
        grammarTag: '关联词 (HSK 4 Conjunctions)',
        whyRight: {
          en: 'Matches exact HSK 4 discourse frames: 不仅…而且 (not only…but also), 不管…也/都 (no matter how), 尽管…但 (even though), 既然…就 (since it’s already settled), 只要…就 (as long as), 甚至 (even to the extent that), 因此 (therefore), 难道…吗 (rhetorical surprise).',
          id: 'Cocok dengan kerangka HSK 4: 不仅…而且 (tidak hanya…tapi juga), 不管…也/都 (tidak peduli seberapa), 尽管…但 (meskipun), 既然…就 (karena sudah terlanjur/memang demikian), 只要…就 (asal saja…langsung), 甚至 (bahkan sampai), 因此 (oleh karena itu), 难道…吗 (masak iya?).',
        },
        distractorNotes: [
          {
            option: '尽管 vs 不管',
            whyWrong: {
              en: '尽管 introduces an actual existing fact ("even though we haven’t known each other long"); 不管 introduces an open/hypothetical degree ("no matter how busy", followed by 也/都).',
              id: '尽管 menyatakan fakta yang nyata ("meskipun kita baru sebentar kenal"); 不管 menyatakan kondisi bebas/seberapa pun ("tidak peduli sesibuk apa", diikuti 也/都).',
            },
          },
        ],
        focusWords: ['不仅', '尽管', '不管', '既然', '只要', '因此', '难道'],
        confusionPairs: [['虽然', '尽管'], ['只要', '只有']],
      },
    ),
    choice(
      'hsk4-gang-gangcai',
      'hsk4a',
      1,
      '我昨天（  ）到杭州，对这儿的环境还不太熟悉；对了，（  ）谁给你打电话了？',
      ['刚 / 刚才', '刚才 / 刚', '刚 / 刚', '刚才 / 刚才'],
      '刚 / 刚才',
      '“刚”前可加时间词“昨天”，作副词用在动词前；“刚才”是时间名词，可直接放在主语前。',
      {
        pattern: '(Time) + Subject + 刚 + Verb | 刚才 + Subject + Verb (or Subject + 刚才 + Verb)',
        grammarTag: '刚 / 刚才',
        whyRight: {
          en: '刚 is an adverb that can follow another time word (昨天刚到), whereas 刚才 is a time noun meaning "a few minutes ago" that can sit before the subject (刚才谁给你打电话了).',
          id: '刚 adalah kata keterangan yang bisa didahului kata waktu lain (昨天刚到); 刚才 adalah kata benda waktu ("barusan/tadi") yang bisa berdiri di depan subjek (刚才谁…).',
        },
        distractorNotes: [
          {
            option: '昨天刚才到',
            whyWrong: {
              en: 'Two time nouns (昨天 + 刚才) cannot stack; 刚才 only means a few minutes ago, never yesterday.',
              id: 'Dua kata benda waktu (昨天 + 刚才) tidak bisa digabung; 刚才 hanya berarti beberapa menit yang lalu, bukan kemarin.',
            },
          },
          {
            option: '刚谁给你打电话了',
            whyWrong: {
              en: 'As an adverb, 刚 cannot sit before the subject 谁.',
              id: 'Sebagai kata keterangan, 刚 tidak boleh diletakkan sebelum subjek 谁.',
            },
          },
        ],
        focusWords: ['刚', '刚才'],
        confusionPairs: [['刚', '刚才']],
      },
    ),
    choice(
      'hsk4-haishi-huozhe',
      'hsk4a',
      3,
      '周末我们去爬山（  ）去看电影？——都可以，你决定去爬山（  ）看电影，我都陪你。',
      ['还是 / 或者', '或者 / 还是', '还是 / 还是', '或者 / 或者'],
      '还是 / 或者',
      '选择疑问句用“还是”；陈述句或条件句里表示“A或B都可以”用“或者”。',
      {
        pattern: 'Choice question: A 还是 B？ | Declarative/conditional alternative: A 或者 B',
        grammarTag: '还是 / 或者',
        whyRight: {
          en: 'The first sentence is a direct choice question asking A or B (去爬山还是去看电影？); the second is a declarative statement listing open options (或者).',
          id: 'Kalimat pertama adalah pertanyaan pilihan langsung (pakai 还是); kalimat kedua adalah pernyataan bebas pilihan (pakai 或者).',
        },
        distractorNotes: [
          {
            option: '或者 in a direct A-or-B question',
            whyWrong: {
              en: 'Mandarin direct alternative questions ("A or B?") require 还是, not 或者.',
              id: 'Kalimat tanya pilihan "A atau B?" dalam Mandarin wajib memakai 还是, bukan 或者.',
            },
          },
        ],
        focusWords: ['还是', '或者'],
        confusionPairs: [['还是', '或者']],
      },
    ),
    choice(
      'hsk4-dui-zai',
      'hsk4a',
      5,
      '（  ）我来说，工作经验比工资更重要；但（  ）经理看来，年轻人应该多学本领。',
      ['对 / 在', '在 / 对', '对 / 对', '按照 / 对'],
      '对 / 在',
      '固定搭配：“对……来说”和“在……看来”。第5课、第10课。',
      {
        pattern: '对 + Person + 来说 (for someone) | 在 + Person + 看来 (in someone’s view)',
        grammarTag: '对…来说 / 在…看来',
        whyRight: {
          en: 'Two fixed HSK 4 perspective frames: 对……来说 pairs 对 with 来说; 在……看来 pairs 在 with 看来.',
          id: 'Dua kerangka sudut pandang tetap di HSK 4: 对……来说 ("bagi seseorang") dan 在……看来 ("menurut pandangan seseorang").',
        },
        distractorNotes: [
          {
            option: '在……来说 / 对……看来',
            whyWrong: {
              en: 'The prepositions and endings are fixed pairs and cannot be swapped.',
              id: 'Kata depan dan akhiran pada dua pola ini sudah tetap dan tidak boleh ditukar.',
            },
          },
        ],
        focusWords: ['对', '在'],
      },
    ),
    choice(
      'hsk4-yet-que',
      'hsk4a',
      2,
      '虽然大家都很看好这个项目，他（  ）认为还有不少问题需要解决。',
      ['却', '但是', '因此', '于是'],
      '却',
      '“却”是副词，必须放在主语“他”的后面；“但是”一般放在主语前面。第2课。',
      {
        pattern: '虽然…, Subject + 却 + Verb/Adj (却 sits AFTER the subject)',
        grammarTag: '却 / 但是',
        whyRight: {
          en: 'Because the blank sits AFTER the subject 他, you must use the adverb 却 ("yet/however").',
          id: 'Karena bagian kosong berada SETELAH subjek 他, harus memakai kata keterangan 却 ("malah/namun").',
        },
        distractorNotes: [
          {
            option: '但是',
            whyWrong: {
              en: '但是 is a conjunction that usually precedes the subject (但是他认为), whereas 却 goes after the subject (他却认为).',
              id: '但是 adalah kata hubung yang normalnya ditaruh di depan subjek (但是他认为), bukan sesudahnya.',
            },
          },
          {
            option: '因此 / 于是',
            whyWrong: {
              en: '因此 and 于是 express cause-and-effect, which contradicts 虽然.',
              id: '因此 dan 于是 menyatakan akibat, bertentangan dengan makna konsesif 虽然.',
            },
          },
        ],
        focusWords: ['却', '但是'],
        confusionPairs: [['但是', '却']],
      },
    ),
    choice(
      'hsk4-suoyi-bu-ru',
      'hsk4a',
      4,
      '我（  ）他会生气，没想到他一点儿（  ）不生气，反而表扬了我。',
      ['以为 / 也', '认为 / 就', '以为 / 才', '原来 / 都'],
      '以为 / 也',
      '“以为”表示说话人原来的判断与事实相反；“一点儿也/都不 + 形容词”表示完全不。第4课。',
      {
        pattern: '以为 (mistaken assumption) | 一点儿 + 也/都 + 不/没 + Adj/V',
        grammarTag: '以为 / 一点儿也不',
        whyRight: {
          en: '以为 marks an assumption that turned out to be wrong ("I thought he’d get angry, didn’t expect…"), and 一点儿也不 is the fixed emphatic negation ("not angry at all").',
          id: '以为 dipakai saat dugaan awal ternyata keliru ("ku kira dia bakal marah"), dan 一点儿也不 adalah pola penekanan negatif ("sama sekali tidak marah").',
        },
        distractorNotes: [
          {
            option: '原来',
            whyWrong: {
              en: '原来 means "it turns out that / originally" (realizing the truth), the opposite of mistaken expectation 以为.',
              id: '原来 berarti "ternyata/semula" (menyadari kenyataan), berbeda fungsi dari dugaan keliru 以为.',
            },
          },
        ],
        focusWords: ['以为', '原来'],
        confusionPairs: [['以为', '原来']],
      },
    ),
    order(
      'hsk4-order-1',
      'hsk4a',
      1,
      ['不仅踢得好', '而且性格也很不错', '他足球', '所以大家都很喜欢他'],
      ['他足球', '不仅踢得好', '而且性格也很不错', '所以大家都很喜欢他'],
      {
        pattern: 'Subject + Topic + 不仅…, 而且…, 所以…',
        grammarTag: '不仅…而且…',
        whyRight: {
          en: 'When both clauses describe the same person or introduce qualities step by step: 他足球不仅踢得好，而且性格也很不错，所以大家都很喜欢他。',
          id: 'Susun subjek/topik dulu (他足球), diikuti 不仅…, lalu 而且…, dan hasil akhirnya 所以大家都很喜欢他.',
        },
        distractorNotes: [
          {
            option: 'Placing 所以 first or splitting 他足球 after 而且',
            whyWrong: {
              en: 'Cause clauses (不仅…而且) must precede the result clause (所以).',
              id: 'Klausa sebab (不仅…而且) harus mendahului klausa akibat (所以).',
            },
          },
        ],
        focusWords: ['不仅', '而且', '所以'],
      },
      {
        en: 'Start with his soccer skill (他足球 + 不仅…), add personality (而且…), end with the result (所以…).',
        id: 'Mulai dari 他足球 + 不仅…, sambung 而且…, akhiri dengan akibat 所以….',
      },
    ),
    order(
      'hsk4-order-2',
      'hsk4a',
      6,
      ['这件事', '竟然让我', '高兴得', '睡不着觉'],
      ['这件事', '竟然让我', '高兴得', '睡不着觉'],
      {
        pattern: 'Subject + 竟然 + 让 + Person + Adj + 得 + Result Complement',
        grammarTag: '竟然 / 程度补语',
        whyRight: {
          en: '竟然 sits before the causative verb 让, followed by the emotional reaction 高兴得 + potential/result degree 睡不着觉.',
          id: '竟然 ditaruh sebelum kata kerja kausatif 让, diikuti reaksi emosi 高兴得 + pelengkap tingkat 睡不着觉.',
        },
        distractorNotes: [
          {
            option: '让我竟然高兴得…',
            whyWrong: {
              en: 'In this sentence 这件事 is the unexpected subject, so 竟然 modifies 让 ("unexpectedly made me…").',
              id: 'Di kalimat ini 这件事 adalah subjek yang mengejutkan, jadi 竟然 menerangkan 让.',
            },
          },
        ],
        focusWords: ['竟然', '睡不着'],
      },
    ),
    order(
      'hsk4-order-3',
      'hsk4a',
      8,
      ['把计划', '不管遇到什么困难', '坚持到底', '我们都应该'],
      ['不管遇到什么困难', '我们都应该', '把计划', '坚持到底'],
      {
        pattern: '不管 + Question/Alternative + Subject + 都 + Modal + 把 + Object + V',
        grammarTag: '不管…都…',
        whyRight: {
          en: '不管遇到什么困难 opens the concessive frame, followed by subject + 都应该, then 把计划 + 坚持到底.',
          id: '不管遇到什么困难 membuka klausa konsesif, diikuti subjek + 都应该, lalu 把计划 + 坚持到底.',
        },
        distractorNotes: [
          {
            option: '把计划不管遇到什么困难…',
            whyWrong: {
              en: '把 + object sits inside the main verb predicate after 我们都应该, never before 不管.',
              id: 'Frasa 把计划 masuk di dalam predikat setelah 我们都应该, bukan di depan 不管.',
            },
          },
        ],
        focusWords: ['不管', '把', '坚持'],
      },
      {
        en: 'Open with "no matter what difficulties" (不管…), then "we all should" (我们都应该), then 把计划 + 坚持到底.',
        id: 'Awali dengan 不管…, lalu 我们都应该, lalu 把计划 + 坚持到底.',
      },
    ),
    order(
      'hsk4-order-4',
      'hsk4a',
      9,
      ['只要我们', '就一定能', '共同努力', '通过这次考试'],
      ['只要我们', '共同努力', '就一定能', '通过这次考试'],
      {
        pattern: '只要 + Condition + 就 + Result',
        grammarTag: '只要…就…',
        whyRight: {
          en: '只要我们共同努力 states the sufficient condition; 就一定能通过这次考试 states the guaranteed outcome.',
          id: '只要我们共同努力 menyatakan syarat cukup; 就一定能通过这次考试 menyatakan hasil yang pasti tercapai.',
        },
        distractorNotes: [
          {
            option: '就一定能共同努力只要我们…',
            whyWrong: {
              en: 'The condition clause (只要…) must come before the consequence clause (就…).',
              id: 'Klausa syarat (只要…) harus mendahului klausa akibat (就…).',
            },
          },
        ],
        focusWords: ['只要', '通过'],
        confusionPairs: [['只要', '只有']],
      },
    ),
    order(
      'hsk4-order-5',
      'hsk4a',
      10,
      ['虽然价格', '可是质量', '贵了点儿', '确实不错'],
      ['虽然价格', '贵了点儿', '可是质量', '确实不错'],
      {
        pattern: '虽然 + Noun + Adj, 可是 + Noun + 确实 + Adj',
        grammarTag: '虽然…但是/可是',
        whyRight: {
          en: 'First clause pairs topic 价格 with predicate 贵了点儿; second clause pairs 可是 + topic 质量 with 确实不错.',
          id: 'Klausa pertama memasangkan 价格 dengan 贵了点儿; klausa kedua memasangkan 可是 + 质量 dengan 确实不错.',
        },
        distractorNotes: [
          {
            option: '可是质量贵了点儿',
            whyWrong: {
              en: 'Expensive (贵) describes price (价格), while good (不错) describes quality (质量).',
              id: 'Mahal (贵) menerangkan harga (价格), sedangkan bagus (不错) menerangkan kualitas (质量).',
            },
          },
        ],
        focusWords: ['虽然', '可是', '确实'],
      },
    ),
    errorFix(
      'hsk4-error-1',
      'hsk4a',
      2,
      '虽然今天天气很冷，所以我还是决定出去跑步。',
      '“虽然”不能与“所以”连用',
      [
        '虽然今天天气很冷，但是我还是决定出去跑步。',
        '因为今天天气很冷，所以我还是决定出去跑步。',
        '虽然今天天气很冷，而且我还是决定出去跑步。',
        '尽管今天天气很冷，所以我还是决定出去跑步。',
      ],
      '虽然今天天气很冷，但是我还是决定出去跑步。',
      {
        pattern: '虽然……但是/可是…… (NEVER 虽然……所以……)',
        grammarTag: '虽然…但是',
        whyRight: {
          en: '虽然 introduces a concession ("although it’s cold"), so the second clause MUST use a contrastive marker like 但是 or 可是 — never 所以.',
          id: '虽然 menyatakan pertentangan ("walaupun dingin"), sehingga klausa kedua WAJIB memakai kata hubung kontras seperti 但是 atau 可是 — bukan 所以.',
        },
        distractorNotes: [
          {
            option: '因为今天天气很冷，所以我还是决定出去跑步。',
            whyWrong: {
              en: 'Cold weather does not cause someone to say 还是决定出去跑步 ("still decided to go run"); the logic is contrastive, not causal.',
              id: 'Cuaca dingin bukan alasan langsung untuk "tetap memutuskan lari keluar" (还是); hubungan logikanya adalah pertentangan.',
            },
          },
          {
            option: '虽然…而且 / 尽管…所以',
            whyWrong: {
              en: '虽然/尽管 cannot pair with 所以 or 而且.',
              id: '虽然 maupun 尽管 tidak bisa dipasangkan dengan 所以 atau 而且.',
            },
          },
        ],
        focusWords: ['虽然', '但是', '所以'],
        confusionPairs: [['虽然', '尽管']],
      },
    ),
    errorFix(
      'hsk4-error-2',
      'hsk4a',
      6,
      '今天下午我把那份重要的文件打印。',
      '把字句动词后不能光秃秃没有其他成分',
      [
        '今天下午我把那份重要的文件打印好了。',
        '今天下午我把那份重要的文件在打印。',
        '今天下午我打印把那份重要的文件。',
        '今天下午我被那份重要的文件打印了。',
      ],
      '今天下午我把那份重要的文件打印好了。',
      {
        pattern: 'Subject + 把 + Object + Verb + Result / 了 / Reduplication / Object',
        grammarTag: '把字句',
        whyRight: {
          en: 'In a 把 sentence, the verb CANNOT stand bare at the end; it needs a result/completion element like 打印好了 or 打印出来了.',
          id: 'Dalam kalimat 把, kata kerja TIDAK boleh berdiri polos tanpa imbuhan/pelengkap di akhir; wajib ditambah pelengkap hasil seperti 打印好了.',
        },
        distractorNotes: [
          {
            option: '我把…在打印',
            whyWrong: {
              en: 'Progressive 在 cannot go after 把 with a bare verb; 把 expresses handling an object to a result.',
              id: 'Penanda sedang berlangsung 在 tidak dipakai begitu saja di belakang objek 把 dengan kata kerja polos.',
            },
          },
          {
            option: '我被那份重要的文件打印了',
            whyWrong: {
              en: 'Reverses subject and agent absurdly ("I was printed by the document").',
              id: 'Membalik makna jadi tidak masuk akal ("saya dicetak oleh dokumen").',
            },
          },
        ],
        focusWords: ['把', '好'],
        confusionPairs: [['把', '被']],
      },
    ),
    errorFix(
      'hsk4-error-3',
      'hsk4a',
      7,
      '昨天刚到北京，他就去了故宫参观了一会儿。',
      '“刚” vs “刚才” 与时间词“昨天”',
      [
        '昨天刚到北京，他就去故宫参观了一会儿。',
        '昨天刚才到北京，他就去了故宫参观了一会儿。',
        '昨天刚到北京一会儿，他就去了故宫参观。',
        '他昨天刚才到北京，就去故宫参观了。',
      ],
      '昨天刚到北京，他就去故宫参观了一会儿。',
      {
        pattern: '刚 + V + 了 (duration) vs V1 + (no double 了) + V2 + 了一会儿',
        grammarTag: '了 / 刚 / 刚才',
        whyRight: {
          en: 'Serial verb purpose/movement ("go to the Palace Museum to visit for a while") puts 了 after the main completed action 参观了一会儿 rather than adding redundant 了 after 去 in 去故宫.',
          id: 'Pada kalimat berantai tujuan ("pergi ke Kota Terlarang lalu berkunjung sebentar"), 了 cukup diletakkan setelah aksi inti 参观了一会儿, bukan dobel di 去.',
        },
        distractorNotes: [
          {
            option: '昨天刚才到北京',
            whyWrong: {
              en: '昨天 cannot combine with 刚才 ("a few minutes ago").',
              id: '昨天 tidak boleh digabung dengan 刚才 ("barusan").',
            },
          },
          {
            option: '刚到北京一会儿',
            whyWrong: {
              en: 'In this sentence the duration 一会儿 belongs to visiting the Palace Museum, not staying in Beijing.',
              id: 'Durasi 一会儿 di sini menerangkan lama kunjungan di Istana Terlarang, bukan baru tiba.',
            },
          },
        ],
        focusWords: ['刚', '刚才', '了'],
        confusionPairs: [['刚', '刚才'], ['了', '过']],
      },
    ),
    errorFix(
      'hsk4-error-4',
      'hsk4a',
      8,
      '只要你每天坚持说汉语，才能慢慢提高口语。',
      '“只要……就……”与“只有……才……”混用',
      [
        '只要你每天坚持说汉语，就能慢慢提高口语。',
        '只有你每天坚持说汉语，就能慢慢提高口语。',
        '不管你每天坚持说汉语，就能慢慢提高口语。',
        '既然你每天坚持说汉语，才能慢慢提高口语。',
      ],
      '只要你每天坚持说汉语，就能慢慢提高口语。',
      {
        pattern: '只要……就…… | 只有……才……',
        grammarTag: '只要…就 / 只有…才',
        whyRight: {
          en: '只要 MUST pair with 就, while 才 MUST pair with 只有. Mixing 只要 with 才 is a classic HSK 4 error.',
          id: '只要 wajib berpasangan dengan 就, sedangkan 才 wajib berpasangan dengan 只有. Mencampur 只要 dengan 才 adalah jebakan klasik HSK 4.',
        },
        distractorNotes: [
          {
            option: '只有…就',
            whyWrong: {
              en: 'Also mismatches the correlative pair (只有 takes 才, never 就).',
              id: 'Ini juga salah pasangan (只有 harus memakai 才, bukan 就).',
            },
          },
          {
            option: '不管…就 / 既然…才',
            whyWrong: {
              en: '不管 pairs with 都/也 (and needs a question word or choice); 既然 pairs with 就.',
              id: '不管 berpasangan dengan 都/也; 既然 berpasangan dengan 就.',
            },
          },
        ],
        focusWords: ['只要', '只有', '就', '才'],
        confusionPairs: [['只要', '只有'], ['就', '才']],
      },
    ),
    reading(
      'hsk4-read-1',
      'hsk4a',
      5,
      '很多人在买东西的时候，往往只看价格，觉得越贵的东西质量越好。其实，“一分钱一分货”虽然有道理，但买东西的时候，更重要的是选择适合自己的，而不是只买贵的。',
      '这段话主要想告诉我们什么？',
      [
        '买东西要选适合自己的，不一定买最贵的',
        '价格越高的东西，对每个人都最合适',
        '便宜的东西质量肯定不好，不能买',
        '买东西的时候完全不用考虑质量',
      ],
      '买东西要选适合自己的，不一定买最贵的',
      {
        pattern: '虽然……但更重要的是……，而不是…… (Contrastive main idea)',
        grammarTag: '阅读理解 (HSK 4)',
        whyRight: {
          en: 'The sentence pivots at 但更重要的是 ("but more importantly"): choose what fits you rather than buying things purely because they are expensive.',
          id: 'Kalimat berbalik pada kata 但更重要的是 ("tetapi yang lebih penting"): pilih barang yang cocok untuk diri sendiri, bukan asal mahal.',
        },
        distractorNotes: [
          {
            option: '价格越高的东西，对每个人都最合适',
            whyWrong: {
              en: 'The author explicitly criticizes buying only expensive things (而不是只买贵的).',
              id: 'Penulis justru mengkritik kebiasaan hanya membeli barang mahal (而不是只买贵的).',
            },
          },
        ],
        focusWords: ['往往', '质量', '适合'],
      },
    ),
    reading(
      'hsk4-read-2',
      'hsk4a',
      9,
      '失败并不可怕，可怕的是失败以后就放弃了。其实，每一次失败都能让我们发现自己的缺点，积累经验。只要不放弃，阳光总在风雨后。',
      '根据这段话，面对失败应该怎么办？',
      [
        '认真总结经验，不要轻易放弃',
        '马上换一个完全不需要努力的计划',
        '遇到困难就停下来，等别人帮忙',
        '认为失败没有任何意义，感到难过',
      ],
      '认真总结经验，不要轻易放弃',
      {
        pattern: '并不可怕，可怕的是…… | 只要不放弃，就……',
        grammarTag: '阅读理解 (HSK 4)',
        whyRight: {
          en: 'The passage states failures reveal weaknesses and build experience (发现缺点，积累经验), and ends with 只要不放弃 ("as long as you don’t give up").',
          id: 'Bacaan menekankan kegagalan membantu kita menemukan kekurangan dan mengumpulkan pengalaman, lalu menutup dengan pesan jangan menyerah (只要不放弃).',
        },
        distractorNotes: [
          {
            option: '认为失败没有任何意义',
            whyWrong: {
              en: 'Directly contradicts 每一次失败都能让我们发现自己的缺点，积累经验.',
              id: 'Bertentangan langsung dengan kalimat bahwa setiap kegagalan memberi pengalaman berharga.',
            },
          },
        ],
        focusWords: ['放弃', '经验', '只要'],
      },
    ),
    reading(
      'hsk4-read-3',
      'hsk4a',
      10,
      '小李：你最近不是一直想找一份跟汉语有关的工作吗？我公司下个月要招翻译，你要不要试试？\n小王：真的吗？太好了！不过我的口语还不够流利，不知道能不能通过面试。',
      '关于小王，从对话中可以知道什么？',
      [
        '他很感兴趣，但对自己的口语还不太自信',
        '他已经拿到小李公司的翻译工作了',
        '他打算放弃学汉语，不想去面试',
        '他觉得翻译面试非常简单，肯定能过',
      ],
      '他很感兴趣，但对自己的口语还不太自信',
      {
        pattern: '不过……，不知道能不能…… (Polite hesitation / caveat)',
        grammarTag: '不过 / 对话推理',
        whyRight: {
          en: '小王 reacts enthusiastically (太好了！) and then introduces a mild reservation with 不过 ("however my spoken Mandarin isn’t fluent enough yet").',
          id: 'Xiao Wang langsung senang (太好了！), lalu menyampaikan keraguan halus dengan 不过 ("hanya saja kemampuan bicaraku belum cukup lancar").',
        },
        distractorNotes: [
          {
            option: '觉得翻译面试非常简单',
            whyWrong: {
              en: 'He explicitly says 不知道能不能通过面试 ("don’t know if I can pass").',
              id: 'Dia jelas berkata 不知道能不能通过面试 ("belum tahu bisa lolos wawancara atau tidak").',
            },
          },
        ],
        focusWords: ['不过', '通过', '流利'],
      },
    ),
  ]
}

const HSK4_BANK: ExamPart[] = buildHsk4Exam()

export function availableGrammarTags(course: ExamCourse, mode: ExamMode = 'grammar'): string[] {
  const parts =
    course === 'jiaocheng'
      ? buildJiaochengMidterm()
      : course === 'hsk4a'
        ? HSK4_BANK
        : [...buildJiaochengMidterm(), ...HSK4_BANK]
  const pool = mode === 'grammar' ? parts.filter((p) => p.kind !== 'reading') : parts
  return [...new Set(pool.map((p) => p.breakdown.grammarTag))]
}

export function buildExamPaper(options: {
  course: ExamCourse
  mode?: ExamMode
  focusTag?: string
  graph?: LearnerGraphState
}): ExamPart[] {
  const { course, mode = 'mock', focusTag, graph } = options
  const jc = buildJiaochengMidterm()
  const hsk = HSK4_BANK
  let base: ExamPart[]
  if (course === 'jiaocheng') {
    base = jc
  } else if (course === 'hsk4a') {
    base = hsk
  } else {
    // Interleave Jiaocheng and HSK 4 so Mixed Final feels cohesive across formats
    const mixed: ExamPart[] = []
    const maxLen = Math.max(jc.length, hsk.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < hsk.length) mixed.push(hsk[i])
      if (i < jc.length) mixed.push(jc[i])
    }
    base = mixed
  }

  if (mode === 'grammar') {
    const grammarFirst = base.filter(
      (p) => p.kind === 'choice' || p.kind === 'order' || p.kind === 'error' || p.kind === 'blanks',
    )
    if (focusTag && focusTag !== 'all' && focusTag !== 'weak') {
      const exact = grammarFirst.filter((p) => p.breakdown.grammarTag === focusTag)
      if (exact.length) return exact
      const fallback = base.filter((p) => p.breakdown.grammarTag === focusTag)
      if (fallback.length) return fallback
    }
    if (graph) {
      const weakTags = new Map(weakGrammarPoints(graph, 20).map((g) => [g.point, g.weight]))
      const scored = [...grammarFirst].sort((a, b) => {
        const wb = weakTags.get(b.breakdown.grammarTag) ?? 0
        const wa = weakTags.get(a.breakdown.grammarTag) ?? 0
        if (wb !== wa) return wb - wa
        // Prefer confused focus words if in weak graph
        const fb = (b.breakdown.focusWords ?? []).reduce((s, w) => s + (weakTags.get(w) ?? 0), 0)
        const fa = (a.breakdown.focusWords ?? []).reduce((s, w) => s + (weakTags.get(w) ?? 0), 0)
        return fb - fa
      })
      if (focusTag === 'weak') {
        const onlyWeak = scored.filter((p) => (weakTags.get(p.breakdown.grammarTag) ?? 0) > 0)
        if (onlyWeak.length) return onlyWeak
      }
      return scored
    }
    return grammarFirst
  }

  // In full mock mode, if learner graph has weak grammar points, surface weak-tag items slightly earlier within each section
  if (graph && Object.keys(graph.nodes).length > 0) {
    const weakTags = new Map(weakGrammarPoints(graph, 20).map((g) => [g.point, g.weight]))
    if (weakTags.size > 0) {
      return [...base].sort((a, b) => {
        const wb = weakTags.get(b.breakdown.grammarTag) ?? 0
        const wa = weakTags.get(a.breakdown.grammarTag) ?? 0
        if (Math.abs(wb - wa) >= 1.5) return wb - wa
        return 0
      })
    }
  }

  return base
}

export function partPoints(part: ExamPart) {
  return part.kind === 'blanks' ? part.blanks.length : 1
}
