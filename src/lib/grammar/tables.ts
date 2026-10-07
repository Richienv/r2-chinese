/**
 * Closed word lists the rules match against. Short on purpose: each entry must be a word where the
 * mistake is unambiguous. Adding a word here widens what is flagged, so add it only with a test.
 */

/** Longest first, so 学习 is tried before 学. */
export const alternation = (words: Iterable<string>): string =>
  [...new Set(words)].sort((a, b) => b.length - a.length || a.localeCompare(b)).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

export const HAN = '\\p{Script=Han}'

/**
 * What can stand just before a verb: the start of the clause, a pronoun, or an adverb or auxiliary.
 * Single-character verbs only count after one of these, so 同学在家 is never read as 学 + 在家.
 */
export const BEFORE_VERB = '(?<=[我你他她它咱们]|也|都|还|又|就|才|很|常|不|没|要|想|会|能|可以|正|刚|总|先|再|去|来|得|爱|喜欢|应该|必须|一起|别|请|该|每天|经常)'

/** What may follow a word and still leave it a whole word, rather than the start of a longer one. */
export const WORD_END = '(?=$|[^\\p{Script=Han}]|[的了吗呢吧啊和与跟也都很不是在有就还要会能可太真最更被把给对用让叫请去来看买])'

export const PLACES = [
  '家', '学校', '公司', '办公室', '教室', '图书馆', '医院', '银行', '商店', '超市', '饭馆', '餐厅', '食堂', '宿舍', '公园',
  '北京', '上海', '杭州', '中国', '这儿', '这里', '那儿', '那里', '外面', '里面', '楼下', '楼上', '房间', '咖啡馆', '机场',
  '车站', '火车站', '酒店', '大学', '印尼', '雅加达', '马来西亚', '浙江大学', '浙大',
] as const

/** Sticks to a place word without making it a new word: 家里, 学校旁边. */
export const PLACE_TAIL = '(?:里面|里头|里|上|下|外面|旁边|附近|中|门口|对面)?'

/** After these a place word is the start of a longer word: 家人, 家庭, 学校长. */
export const PLACE_BREAK = '(?![人庭长属务乡具产生活])'

/**
 * Verbs that take their place before them: 在家 学习, never 学习 在家.
 * 住 坐 放 站 躺 睡 写 挂 停 生 are left out on purpose: 住在 and 放在 are correct.
 */
export const ACTION_VERBS = [
  '学习', '吃饭', '吃午饭', '吃晚饭', '吃早饭', '睡觉', '看书', '看电视', '看电影', '买东西', '上班', '上课', '做饭', '聊天',
  '打球', '运动', '跑步', '游泳', '休息', '洗澡', '读书', '复习', '练习', '上网', '唱歌', '跳舞', '写作业', '做作业', '打工',
] as const

/**
 * One-character verbs. They need BEFORE_VERB in front. 看 写 等 are not here:
 * 写在黑板上 and 等在门口 are correct.
 */
export const ACTION_VERBS_SINGLE = ['学', '吃', '喝', '玩', '买', '做'] as const

export const TIME_WORDS = [
  '今天', '明天', '昨天', '后天', '前天', '现在', '早上', '上午', '中午', '下午', '晚上', '今晚', '明晚', '昨晚', '今年', '明年',
  '去年', '下周', '上周', '下个月', '上个月', '下个星期', '上个星期',
] as const

/** Verbs a time word is wrongly put after: 去北京明天. */
export const MOVE_VERBS = ['去', '来', '回', '到', '买', '吃', '喝', '看', '学', '做', '写', '打', '开', '见', '找', '等'] as const

export const LONG_MOVE_VERBS = ['学习', '见面', '开会', '上课', '上班', '出发', '回家', '看电影', '看书', '吃饭', '睡觉'] as const

/** Past-time markers: with one of these, 没 + verb + 了 is a mistake and not "no longer". */
export const PAST_MARKERS = ['昨天', '前天', '上周', '上个星期', '上个月', '去年', '昨晚', '刚才', '以前', '上次'] as const

/** Words that make 没 + verb + 了 mean "no longer", which is correct. */
export const NO_LONGER = ['再', '也', '都', '从', '一直', '终于', '就', '才', '已经', '还', '越来越', '渐渐', '慢慢', '后来', '现在', '以后', '不再'] as const

export const NEGATED_VERBS = ['吃', '去', '来', '看', '买', '做', '学', '说', '写', '听', '喝', '到', '见', '睡', '找', '问', '回', '走', '跑', '开', '关'] as const

/** Core adjectives. The course vocabulary adds more at run time (Lexicon). */
export const ADJECTIVES = [
  '好', '坏', '大', '小', '多', '少', '高', '矮', '长', '短', '胖', '瘦', '新', '旧', '快', '慢', '早', '晚', '远', '近', '贵',
  '便宜', '热', '冷', '累', '忙', '饿', '渴', '困', '难', '容易', '简单', '复杂', '漂亮', '好看', '难看', '好吃', '好喝', '好玩',
  '高兴', '开心', '快乐', '难过', '生气', '紧张', '害怕', '聪明', '年轻', '干净', '脏', '安静', '热闹', '方便', '危险', '健康',
  '舒服', '辣', '甜', '酸', '咸', '苦', '重', '轻', '满意', '认真', '努力', '清楚', '流利', '不错', '合适', '重要',
] as const

/**
 * Adjectives that are also fine after 是 on their own: 我是大 ("I am the elder"), 是对 (it is right).
 * They are never reported by shi-adj.
 */
export const SHI_EXEMPT = new Set([
  '好', '坏', '大', '小', '多', '少', '新', '旧', '长', '短', '早', '晚', '对', '错', '真', '假', '同', '一样', '不同', '重要', '不错', '合适', '清楚',
])

export const DEGREE = ['很', '非常', '特别', '十分', '挺', '太', '真', '比较', '相当'] as const

/** Feeling and opinion verbs: the degree word goes in front (很喜欢), never behind (喜欢很). */
export const FEELING_VERBS = ['喜欢', '爱', '想', '怕', '担心', '同意', '讨厌', '关心', '感谢', '希望', '相信', '羡慕', '佩服'] as const

/** 一个书 → 一本书. `informal` ones are said with 个 in everyday speech, so they are only worth a look. */
export const MEASURE_NOUNS: ReadonlyArray<{ noun: string; measure: string; informal?: boolean }> = [
  { noun: '书', measure: '本' }, { noun: '杂志', measure: '本' }, { noun: '衣服', measure: '件' }, { noun: '裤子', measure: '条' },
  { noun: '裙子', measure: '条' }, { noun: '鱼', measure: '条' }, { noun: '狗', measure: '只' }, { noun: '猫', measure: '只' },
  { noun: '鸟', measure: '只' }, { noun: '床', measure: '张' }, { noun: '照片', measure: '张' }, { noun: '纸', measure: '张' },
  { noun: '汽车', measure: '辆' }, { noun: '自行车', measure: '辆' }, { noun: '车', measure: '辆' }, { noun: '雨伞', measure: '把' },
  { noun: '伞', measure: '把' }, { noun: '刀', measure: '把' }, { noun: '花', measure: '朵' }, { noun: '树', measure: '棵' },
  { noun: '歌', measure: '首' }, { noun: '电视', measure: '台' }, { noun: '电影', measure: '部', informal: true },
  { noun: '电脑', measure: '台', informal: true }, { noun: '桌子', measure: '张', informal: true },
  { noun: '椅子', measure: '把', informal: true }, { noun: '地图', measure: '张', informal: true },
  { noun: '手表', measure: '块', informal: true }, { noun: '窗户', measure: '扇', informal: true }, { noun: '门', measure: '扇', informal: true },
]

/** Verbs that wrongly take 的 before a degree phrase, with no "what they V" reading: 跑的很快. */
export const DE_VERBS_CLEAR = ['跑', '走', '睡', '玩', '跳', '游', '飞', '笑', '哭', '长', '过', '活', '来', '起', '站', '坐', '爬', '开'] as const

/** These can also mean "what they V" (他说的很好), so the sentence is only worth a look. */
export const DE_VERBS_AMBIGUOUS = ['说', '写', '做', '学', '吃', '唱', '画', '讲', '读', '听', '看'] as const

export const DE_QUALITIES = ['好', '快', '慢', '早', '晚', '清楚', '流利', '认真', '不错', '多', '少', '漂亮', '好看', '高', '远', '累', '开心', '高兴', '努力'] as const

export const VERB_OBJECT_DE_OBJECTS = [
  '汉语', '中文', '英语', '英文', '日语', '法语', '印尼语', '话', '字', '汉字', '歌', '饭', '菜', '车', '球', '足球', '篮球', '画', '舞', '游泳', '太极拳',
] as const

export const VERB_OBJECT_DE_VERBS = ['说', '写', '学', '唱', '做', '吃', '开', '踢', '打', '跳', '画', '讲'] as const

/** With these in the clause, A-not-A + 吗 can be an embedded question and is correct: 你知道他来不来吗. */
export const EMBEDDING_VERBS = ['知道', '问', '想知道', '告诉', '记得', '清楚', '明白', '觉得', '猜', '打听', '确定', '检查', '看看', '试试', '决定', '考虑', '怀疑', '担心', '不知道'] as const

/** A-not-A adjectives that make 有点 + adjective a stack: 很有点累. */
export const DEGREE_STACK_ADJ = ['累', '贵', '冷', '热', '难', '饿', '渴', '忙', '麻烦', '慢', '远', '困', '辣', '咸', '酸', '甜', '紧张', '生气', '害怕', '不舒服', '无聊', '重', '吵', '脏', '晚'] as const

export const BA_VERBS = ['看', '买', '吃', '喝', '做', '写', '学', '用', '洗', '说', '读', '听', '拿', '放', '找', '打', '关', '开', '唱', '画', '修', '卖', '带'] as const

export const NUMERALS = '[一二两三四五六七八九十百几]'
