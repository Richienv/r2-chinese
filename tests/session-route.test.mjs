import test from 'node:test'
import assert from 'node:assert/strict'
import { compactLessonSteps, compactStepId, resumeSessionIndex, practiceChoices, resumePracticeIds, nextSessionIndex } from '../src/lib/sessionRoute.ts'
import { readLearningCheckpoint, writeLearningCheckpoint } from '../src/lib/resume.ts'

const source = [
  ...['法律', '印象'].flatMap(zh => ['meet', 'hook', 'example', 'seal'].map(phase => ({kind:'teach', id:`${phase}:t1:${zh}`, phase, word:{zh}, n:9, of:99}))),
  ...Array.from({length:7}, (_,i)=>({kind:'recall',id:`recall:${i}`})),
  {kind:'read',id:'read:1'}, {kind:'note',id:'note:1'},
  ...Array.from({length:4},(_,i)=>({kind:'quiz',id:`quiz:${i}`})),
  {kind:'dialogue',id:'dialogue:1'}, {kind:'produce',id:'produce:1'}, {kind:'produce',id:'produce:2'}, {kind:'complete'}
]
const compact=compactLessonSteps(source)

test('one word card preserves source objects and stable IDs; reading precedes optional practice',()=>{
  assert.deepEqual(compact.slice(0,4).map(s=>s.id),['meet:t1:法律','meet:t1:印象','read:1','note:1'])
  assert.equal(compact[0].word,source[0].word)
  assert.deepEqual(compact.slice(0,2).map(s=>[s.n,s.of]),[[1,2],[2,2]])
  assert.equal(source[0].n,9)
  assert.equal(compact.at(-1).kind,'complete')
  assert.equal(compact.filter(s=>s.kind==='recall').length,7)
  for(const phase of ['hook','example','seal']) assert.equal(compactStepId(`${phase}:t1:法律`),'meet:t1:法律')
  assert.equal(compactStepId('recall:t1:法律'),'recall:t1:法律')
})

test('practice offers bounded rounds and chooses the source sentence over a full dialogue',()=>{
  assert.deepEqual(practiceChoices(compact),[
    {mode:'words',ids:['recall:0','recall:1','recall:2']},
    {mode:'meaning',ids:['quiz:0','quiz:1','quiz:2']},
    {mode:'sentence',ids:['produce:1']}
  ])
  assert.deepEqual(practiceChoices([{kind:'dialogue',id:'d'}]),[{mode:'sentence',ids:['d']}])
  assert.deepEqual(practiceChoices([{kind:'complete'}]),[])
})

test('continue or skip follows only the selected round and ends without forcing other modes',()=>{
  const selected=['recall:0','recall:1','recall:2']
  let index=compact.findIndex(s=>s.id===selected[0])
  index=nextSessionIndex(compact,index,selected)
  assert.equal(compact[index].id,selected[1])
  index=nextSessionIndex(compact,index,selected)
  assert.equal(compact[index].id,selected[2])
  assert.equal(nextSessionIndex(compact,index,selected),compact.length-1)
  assert.equal(nextSessionIndex(compact,0,null),1)
})

test('legacy checkpoints reopen at the exact activity and bound the remaining practice',()=>{
  assert.deepEqual(resumePracticeIds(compact,'recall:5'),['recall:5','recall:6'])
  assert.deepEqual(resumePracticeIds(compact,'quiz:1'),['quiz:1','quiz:2','quiz:3'])
  assert.deepEqual(resumePracticeIds(compact,'produce:2'),['produce:2'])
  assert.equal(resumePracticeIds(compact,'hook:t1:法律'),null)
  assert.equal(resumePracticeIds(compact,'recall:0',[]),null)
  assert.deepEqual(resumePracticeIds(compact,'quiz:1',['quiz:1','quiz:1','gone']),['quiz:1'])
})

test('new route checkpoint is additive and writing it preserves other old sessions',()=>{
  const map=new Map()
  globalThis.localStorage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}
  try {
    const old={stepId:'hook:t1:法律',retryWords:['法律'],assistedSteps:['recall:0']}
    const selected={stepId:'quiz:1',practiceIds:['quiz:0','quiz:1','quiz:2'],retryWords:[],assistedSteps:[]}
    writeLearningCheckpoint('old',old)
    writeLearningCheckpoint('new',selected)
    assert.deepEqual(readLearningCheckpoint('old'),old)
    assert.deepEqual(readLearningCheckpoint('new'),selected)
    writeLearningCheckpoint('new',{...selected,practiceIds:[]})
    assert.deepEqual(readLearningCheckpoint('new').practiceIds,[])
    map.set('yulu.learning-checkpoints.v1',JSON.stringify({invalid:{...old,practiceIds:['quiz:0',1,'quiz:0',null]},legacy:{...old,practiceIds:'bad'}}))
    assert.deepEqual(readLearningCheckpoint('invalid').practiceIds,['quiz:0'])
    assert.deepEqual(readLearningCheckpoint('legacy'),old)
  } finally { delete globalThis.localStorage }
})


test('a fresh session starts at the first card, never the ID-less completion screen',()=>{
  assert.equal(resumeSessionIndex(compact),0)
  assert.equal(resumeSessionIndex(compact,''),0)
  assert.equal(resumeSessionIndex(compact,'missing-old-id'),0)
  assert.equal(resumeSessionIndex(compact,'seal:t1:印象'),1)
  assert.equal(compact[resumeSessionIndex(compact,'recall:5')].id,'recall:5')
})
