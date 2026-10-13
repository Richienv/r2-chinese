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

/** A stretch of time before 没 means "for N days I have not … ": 三天没吃饭了 is correct with the final 了. */
export const DURATION = '(?:很久|好久|多久|多长时间|(?:[一二两三四五六七八九十几百]+|半)个?(?:天|年|月|周|星期|分钟|小时))'

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

// ---- Language transfer: what the rules in rules-transfer.ts look for ----

/** Habits and frequencies go before the verb like a time word: 我每天去学校, not 我去学校每天. */
export const HABIT_WORDS = ['每天', '每周', '每年', '每个月', '每个星期', '周末', '经常', '常常', '总是'] as const

/** Questions about time go before the verb: 你什么时候去, not 你去什么时候. */
export const ASK_TIME = ['什么时候', '几点', '哪天', '几号'] as const

/** One date part: a number and 年, 月 or 号/日. */
export const DATE_PART = '(?:\\d{1,4}|[〇零一二三四五六七八九十]{1,4})(?:年|月|号|日)'

/** 一起 goes before the verb: 我们一起去, not 我们去一起. 住 is left out: 住一起 is said. */
export const TOGETHER_LONG = ['学习', '吃饭', '旅行', '旅游', '看电影', '看书', '工作', '运动', '唱歌', '跳舞', '回家', '开会', '上课'] as const
export const TOGETHER_SINGLE = ['去', '来', '吃', '喝', '玩', '看', '做', '学', '买', '唱', '听', '走', '跑'] as const

/** Verbs that need 得 before how well or how fast they are done: 跑得很快, not 跑很快. 说 看 听 are left out: 他说很好, 我看很好 are said. */
export const DE_MISSING_VERBS = ['跑', '走', '睡', '玩', '跳', '游', '飞', '笑', '哭', '长', '过', '活', '起', '来', '站', '爬', '开', '唱', '学', '写', '做', '吃', '画'] as const
/** 多 少 远 久 are left out: 吃很多, 走很远 are said. 太 is left out too: 跑太快了 is said. */
export const DE_MISSING_QUALITIES = ['好', '快', '慢', '早', '晚', '流利', '认真', '开心', '高兴', '努力', '清楚', '漂亮', '不错', '高', '累'] as const
export const DE_MISSING_DEGREE = ['很', '非常', '特别', '十分', '挺', '比较', '相当'] as const

/** Topics after 感兴趣 that show the 对 is missing: 我对中文感兴趣, not 我感兴趣中文. */
export const INTEREST_TOPICS = [
  '中文', '汉语', '英语', '英文', '日语', '音乐', '电影', '历史', '文化', '足球', '篮球', '体育', '运动', '政治', '经济', '科学', '艺术',
  '旅游', '美食', '书法', '绘画', '编程', '电脑', '游戏', '新闻', '法律', '医学', '数学', '汉字', '科技', '摄影', '舞蹈', '文学', '哲学',
  '心理学', '管理', '市场', '商业', '创业', '投资', '金融', '技术', '人工智能', '中国', '北京',
] as const

/** Places that take 在 and nothing after: 在北京, not 在北京里. */
export const CITIES = [
  '北京', '上海', '杭州', '广州', '深圳', '成都', '重庆', '香港', '台湾', '中国', '印尼', '印度尼西亚', '雅加达', '万隆', '泗水', '巴厘岛',
  '马来西亚', '吉隆坡', '新加坡', '日本', '东京', '韩国', '首尔', '美国', '英国', '泰国', '越南', '澳大利亚',
] as const

/** Verbs that wrongly take 也 or 都 after them: 我也去, not 我去也. */
export const ADVERB_AFTER_VERBS = [
  '喜欢', '知道', '认识', '同意', '明白', '觉得', '学习', '工作', '开始', '去', '来', '吃', '喝', '看', '学', '买', '做', '说', '写', '听', '玩', '爱', '想', '是', '有', '要', '会', '能', '懂',
] as const

/** Jobs and nationalities after 不 show the 是 is missing: 我不是学生, not 我不学生. */
export const IDENTITY_NOUNS = [
  '学生', '老师', '医生', '工程师', '大学生', '经理', '老板', '朋友', '同学', '同事', '秘书', '律师', '护士', '司机', '厨师',
  '中国人', '印尼人', '印度尼西亚人', '马来西亚人', '美国人', '日本人', '韩国人', '英国人', '新加坡人',
] as const

/** An adjective before 比 is the comparison in the wrong place: 我比他高, not 我高比他. 好 is left out: 好比 is a word. */
export const COMPARISON_STOP = '(?!例|重|分|赛|较|率|如|方|喻|拼|萨|特|利)'

/** A number straight onto the noun, with no measure word: 三本书, not 三书. */
export const MEASURE_MISSING: ReadonlyArray<readonly [noun: string, measure: string]> = [
  ['书', '本'], ['杂志', '本'], ['朋友', '个'], ['学生', '个'], ['同学', '个'], ['孩子', '个'], ['苹果', '个'], ['问题', '个'],
  ['电影', '部'], ['电脑', '台'], ['手机', '个'], ['狗', '只'], ['猫', '只'], ['椅子', '把'], ['桌子', '张'], ['衣服', '件'],
  ['车', '辆'], ['老师', '位'], ['医生', '位'], ['房间', '个'], ['照片', '张'], ['裤子', '条'], ['鱼', '条'], ['歌', '首'],
]
