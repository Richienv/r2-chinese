import { lessons } from '../content'
import { lexiconFrom } from './check.ts'

/** The adjectives the learner has met in the HSK 4A lessons, so the classifier knows more than its built-in list. */
export const courseLexicon = lexiconFrom(lessons.flatMap((lesson) => lesson.vocab))
