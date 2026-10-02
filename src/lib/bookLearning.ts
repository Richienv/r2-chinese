import type { BooksChapter, BooksSitting } from './books'

export interface BookLearningPlan {
  principle: { title: string; explanation: string; sourceSittingId: string }
  caseStudy: {
    label: string
    title: string
    situation: string
    question: string
    choices: { label: string; consequence: string; reason: string }[]
    recommended: number
    boundary: string
  }
  mindset: { before: string; after: string; why: string; prompt: string }
  teachBackPrompt: string
  actionPrompt: string
  reviewPrompt: string
}

type Source = BooksSitting

function sourceItems(chapter: BooksChapter): Source[] {
  return chapter.beats?.length ? chapter.beats : chapter.sittings
}

/** Coaching supports reflection; it never evaluates the learner's understanding. */
export function getBookLearningPlan(chapter: BooksChapter): BookLearningPlan {
  const items = sourceItems(chapter)
  const source = items.find(item => item.kind === 'idea' && item.bodyEn.trim()) ?? items.find(item => item.bodyEn.trim()) ?? items[0]
  const title = chapter.titleEn || source?.titleEn || 'This chapter'
  const concept = source?.terms?.[0]?.en || source?.titleEn || title
  const prompt = items.find(item => item.kind === 'try' && item.prompt)?.prompt
  return {
    principle: {
      title,
      explanation: `The passage “${source?.titleEn || title}” asks you to connect ${concept} to a real decision. An idea becomes useful when you can explain which action changes the result, and which condition would stop that mechanism from working. Use the source passage to identify that condition before transferring the idea to your own work.`,
      sourceSittingId: source?.id || '',
    },
    caseStudy: {
      label: 'Practice scenario',
      title: `Apply ${title}`,
      situation: `You are deciding how to use “${concept}” in a current project. Your situation differs from the chapter's example, and you have a limited amount of time to test the idea.`,
      question: 'Which next move would give you useful evidence?',
      choices: [
        { label: 'Copy the example without checking the conditions', consequence: 'You can move quickly, but a mismatch may consume the time you set aside.', reason: 'The same visible action can produce a different result when its enabling conditions are missing.' },
        { label: 'Name the mechanism and run a bounded test', consequence: 'You can compare an observed result with your prediction before committing more.', reason: `Testing one concrete implication of “${concept}” separates learning from merely agreeing with the chapter.` },
        { label: 'Wait until you feel certain', consequence: 'You avoid an immediate commitment but collect no new evidence.', reason: 'Certainty about an unfamiliar situation rarely arrives through rereading alone.' },
      ],
      recommended: 1,
      boundary: 'A bounded test is appropriate only when its costs and effects are acceptable. If it affects other people, agree on the scope before trying it.',
    },
    mindset: {
      before: 'Recognizing the idea means I understand it.',
      after: 'I understand it better when I can explain a mechanism, apply it, and name a limit.',
      why: `“${title}” needs a decision in your own words, not a copied summary.`,
      prompt: `Where would “${concept}” help you, and where would its conditions fail?`,
    },
    teachBackPrompt: `Explain “${title}” without reopening the source: what changes, why does it work, and what would make it fail?`,
    actionPrompt: prompt || `Use “${concept}” in one small decision this week. Record the action, your prediction, and the evidence you will check.`,
    reviewPrompt: `Recall “${title}” tomorrow. What mechanism and limit do you remember, and what did your test change?`,
  }
}
