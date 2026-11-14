import test from 'node:test'
import assert from 'node:assert/strict'
import { drillSelection, reviewRatings, progressAction } from '../src/lib/practiceExperience.ts'
import { matchesWord } from '../src/lib/wordSearch.ts'

test('a short drill deduplicates without mutating or dropping saved words; all is explicit',()=>{
 const words=[' 法律 ','法律','',...Array.from({length:14},(_,i)=>`词${i}`)]
 const original=[...words]
 assert.equal(drillSelection(words).length,8)
 assert.equal(drillSelection(words)[0],'法律')
 assert.equal(drillSelection(words,true).length,15)
 assert.deepEqual(words,original)
 assert.deepEqual(drillSelection([]),[])
 assert.deepEqual(drillSelection(['法律']),['法律'])
})

test('review actions preserve evidence rules for every state, without impossible rating buttons',()=>{
 for(const hadMiss of [true,false]) for(const checked of [true,false]) for(const helped of [true,false]) for(const selfMode of [true,false]) {
  const ratings=reviewRatings({hadMiss,checked,helped,selfMode})
  if(hadMiss) assert.deepEqual(ratings,['again'])
  else if(helped||(!checked&&!selfMode)) assert.deepEqual(ratings,['again','hard'])
  else assert.deepEqual(ratings,['again','hard','good','easy'])
 }
})

test('progress never sends an all-caught-up learner into an empty review queue',()=>{
 assert.equal(progressAction(5,2),'due')
 assert.equal(progressAction(0,2),'hard')
 assert.equal(progressAction(0,0),'learn')
})

test('pinyin search handles tones, spaced syllables, v, u-colon, case and apostrophes',()=>{
 const law={zh:'法律',pinyin:'fǎlǜ',en:'law'}
 for(const q of ['法律','法','law','LAW','falu','falv','fa3 lv4','fǎ lǜ',' fa3 lu:4 ']) assert.equal(matchesWord(law,q),true,q)
 assert.equal(matchesWord({zh:'西安',pinyin:"Xī’ān",en:"Xi'an"},'xi an'),true)
 assert.equal(matchesWord(law,'rice'),false)
 assert.equal(matchesWord(law,'   '),true)
 assert.equal(matchesWord({zh:'新词'},'新'),true)
 assert.equal(matchesWord(law,'3'),false,'a bare tone number cannot match every pinyin')
 assert.equal(matchesWord({zh:'三个',pinyin:'sān ge',en:'3 items'},'3'),true,'numeric meanings remain searchable')
})
