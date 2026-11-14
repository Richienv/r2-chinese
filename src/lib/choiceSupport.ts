/** Keep the answer and one live distractor in their original order. */
export function narrowChoices<T extends { zh: string }>(options: readonly T[], answer: string, wrong: readonly string[]): T[] {
  const alternative = options.find(option => option.zh !== answer && !wrong.includes(option.zh))
  return options.filter(option => option.zh === answer || option === alternative)
}
export function quizAssisted(previousMiss: boolean, persistedHelp: boolean, currentHelp: boolean): boolean {
  return previousMiss || persistedHelp || currentHelp
}
