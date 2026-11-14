import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root=fileURLToPath(new URL('..',import.meta.url))
const directory=mkdtempSync(join(tmpdir(),'hsk-session-screen-'))
let render

test.before(async()=>{
 const result=await build({
  stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    import {useSessionRoute} from './src/components/useSessionRoute';
    import {PracticeChoiceScreen,SessionProgress} from './src/components/SessionFlow';
    import {WordRecall} from './src/components/WordRecall';
    import {StoreProvider} from './src/store/store'; import {CourseProvider} from './src/lib/course';
    function Route({steps,checkpoint}) { const route=useSessionRoute(steps,checkpoint);return <output>{JSON.stringify({i:route.i,kind:route.step.kind,choosing:route.choosing,selected:route.selected})}</output> }
    export function render(which,props) { const Component=which==='route'?Route:which==='choice'?PracticeChoiceScreen:which==='stages'?SessionProgress:WordRecall;
      return renderToStaticMarkup(<CourseProvider><StoreProvider initial={{prefs:{soundOn:false,showPinyin:true,showEnglish:true}}}><Component {...props}/></StoreProvider></CourseProvider>); }
  `,resolveDir:root,loader:'tsx'},
  bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent',define:{'import.meta.env':'{}'},
  plugins:[{name:'static-assets',setup(b){
   b.onResolve({filter:/\.(css|bin|TXT)(\?url)?$/},args=>({path:args.path,namespace:'asset'}))
   b.onLoad({filter:/.*/,namespace:'asset'},()=>({contents:'export default "local-asset"',loader:'js'}))
   b.onLoad({filter:/(overlays|kerja|jiaocheng)\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replaceAll('import.meta.glob','(() => ({}))'),loader:'ts'}))
  }}]
 })
 const output=join(directory,'screens.cjs');writeFileSync(output,result.outputFiles[0].contents)
 render=createRequire(import.meta.url)(output).render
})
test.after(()=>rmSync(directory,{recursive:true,force:true}))

const steps=[{kind:'teach',id:'meet:t1:法律'},{kind:'recall',id:'recall:t1:法律'},{kind:'recall',id:'recall:t1:俩'},{kind:'complete'}]
function route(checkpoint){return JSON.parse(render('route',{steps,checkpoint}).replace(/^<output>|<\/output>$/g,'').replaceAll('&quot;','"'))}

test('actual route hook opens a fresh lesson and a legacy insight on the word, not the final screen',()=>{
 assert.deepEqual(route(),{i:0,kind:'teach',choosing:false,selected:null})
 assert.equal(route({stepId:'hook:t1:法律'}).i,0)
})
test('actual route hook resumes legacy recall and distinguishes a saved choice screen',()=>{
 assert.deepEqual(route({stepId:'recall:t1:俩'}),{i:2,kind:'recall',choosing:false,selected:['recall:t1:俩']})
 assert.deepEqual(route({stepId:'recall:t1:法律',practiceIds:[]}),{i:1,kind:'recall',choosing:true,selected:null})
 assert.equal(route({stepId:'recall:t1:俩',practiceIds:['recall:t1:法律','recall:t1:俩']}).selected.length,2)
})
test('practice selection exposes an explicit finish action and the three simple stages',()=>{
 const html=render('choice',{choices:[{mode:'words',ids:['a','b','c']},{mode:'sentence',ids:['d']}],onChoose(){},onFinish(){}})
 assert.match(html,/3 short questions/);assert.match(html,/Finish for now/);assert.match(html,/Start this round/)
 const stages=render('stages',{kind:'produce'})
 assert.match(stages,/Learn/);assert.match(stages,/Practise/);assert.match(stages,/Done/)
 assert.doesNotMatch(stages,/Encounter|Understand|Retrieve|Revisit|Produce/)
})
test('blind recall starts compact with one answer field, a direct reveal and no leaked source answer',()=>{
 const html=render('recall',{word:{zh:'法律',pinyin:'fǎlǜ',en:'law'},n:1,of:3,onAttempt(){},onComplete(){}})
 assert.match(html,/<h2>law<\/h2>/)
 assert.equal((html.match(/<input\b/g)??[]).length,1)
 assert.match(html,/Show answer/);assert.match(html,/Hint/)
 assert.doesNotMatch(html,/法律|fǎlǜ|Reading display|Hints help learning|production-prompt/)
})
