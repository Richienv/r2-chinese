/** Indonesian (Gen Z) interface strings, keyed by the exact English source. One file per area. */
import shared from './id/shared.ts'
import shell from './id/shell.ts'
import learn from './id/learn.ts'
import practice from './id/practice.ts'
import review from './id/review.ts'
import courses from './id/courses.ts'
import reading from './id/reading.ts'
import engine from './id/engine.ts'

const id: Record<string, string> = { ...shared, ...shell, ...learn, ...practice, ...review, ...courses, ...reading, ...engine }
export default id
