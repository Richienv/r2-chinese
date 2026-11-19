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
    import {SessionProgress} from './src/components/SessionFlow';
    import {WordRecall} from './src/components/WordRecall';
    import {StoreProvider} from './src/store/store'; import {CourseProvider} from './src/lib/course';
    function Route({steps,checkpoint}) { const route=useSessionRoute(steps,checkpoint);return <output>{JSON.stringify({i:route.i,kind:route.step.kind,selected:route.selected})}</output> }
    export function render(which,props) { const Component=which==='route'?Route:which==='stages'?SessionProgress:WordRecall;
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
 assert.deepEqual(route(),{i:0,kind:'teach',selected:null})
 assert.equal(route({stepId:'hook:t1:法律'}).i,0)
})
test('actual route hook resumes legacy recall and opens an unchosen practice straight into word recall',()=>{
 assert.deepEqual(route({stepId:'recall:t1:俩'}),{i:2,kind:'recall',selected:['recall:t1:俩']})
 assert.deepEqual(route({stepId:'recall:t1:法律',practiceIds:[]}),{i:1,kind:'recall',selected:['recall:t1:法律','recall:t1:俩']})
 assert.equal(route({stepId:'recall:t1:俩',practiceIds:['recall:t1:法律','recall:t1:俩']}).selected.length,2)
})
test('the three simple stages show where the learner is inside the current one',()=>{
 assert.match(render('stages',{kind:'recall',n:1,of:3}),/Practise<b>1\/3<\/b>/)
 assert.match(render('stages',{kind:'teach',n:2,of:7}),/Learn<b>2\/7<\/b>/)
 const stages=render('stages',{kind:'produce'})
 assert.match(stages,/Learn/);assert.match(stages,/Practise/);assert.match(stages,/Done/)
 assert.doesNotMatch(stages,/Encounter|Understand|Retrieve|Revisit|Produce/)
})
test('blind recall starts compact with one answer field, one hint button and no leaked source answer',()=>{
 const html=render('recall',{word:{zh:'法律',pinyin:'fǎlǜ',en:'law'},n:1,of:3,onAttempt(){},onComplete(){}})
 assert.match(html,/<h2>law<\/h2>/)
 assert.equal((html.match(/<input\b/g)??[]).length,1)
 assert.match(html,/Hint/);assert.match(html,/placeholder="Type the Hanzi here"/)
 assert.doesNotMatch(html,/Show answer|Skip for now|Write the Mandarin word/)
 assert.doesNotMatch(html,/法律|fǎlǜ|Reading display|Hints help learning|production-prompt/)
})
