import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const directory=mkdtempSync(join(tmpdir(),'hsk-usability-'))
let ui

test.before(async()=>{
 const result=await build({
  stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
   import {SavedWords} from './src/screens/SavedWords'; import {Profile} from './src/screens/Profile'; import {AuthProvider} from './src/auth/AuthProvider'; import {VocabBrowser} from './src/screens/VocabBrowser';
   import {DrillFlow} from './src/screens/Drill'; import {Progress} from './src/screens/Progress'; import {ReviewFlow} from './src/screens/Review'; import {BookSourceReader,BookPrinciple} from './src/components/BookTeaching';
   import {StoreProvider} from './src/store/store'; import {CourseProvider} from './src/lib/course';
   import {encounter} from './src/lib/mastery'; import {newCard} from './src/lib/srs';
   let captured; export const actions=[];
   const state={prefs:{soundOn:false,showPinyin:true,showEnglish:true},starred:['印象','法律'],mastery:{法律:encounter(undefined,'法律',1),印象:encounter(undefined,'印象',1)},cards:{法律:{...newCard('法律',1),due:Date.now()+1e12,interval:60}}};
   export function render(which,props={}) {
    actions.length=0;
    const Component=({profile:Profile,saved:SavedWords,vocab:VocabBrowser,drill:DrillFlow,progress:Progress,review:ReviewFlow,reader:BookSourceReader,principle:BookPrinciple})[which];
    function Capture(){captured=Component({...props,onClose(){},onPlacement(){},onDrill:(words)=>actions.push(words),onLearn:()=>actions.push('learn'),onReview:()=>actions.push('review')});return captured;}
    const previous=globalThis.document;globalThis.document={body:{},addEventListener(){}};
    try{return renderToStaticMarkup(<AuthProvider><CourseProvider><StoreProvider initial={state}><Capture/></StoreProvider></CourseProvider></AuthProvider>)}finally{if(previous)globalThis.document=previous;else delete globalThis.document;}
   }
   function flat(value){return Array.isArray(value)?value.map(flat).join(''):typeof value==='object'&&value?flat(value.props?.children):String(value??'')}
   export function activate(label){
     let target;function walk(value){if(!value)return;if(Array.isArray(value)){value.forEach(walk);return}if(typeof value!=='object')return;
       if(value.type==='button'&&(value.props['aria-label']===label||flat(value.props.children)===label))target=value;
       walk(value.props?.children);
     }walk(captured);if(!target)throw Error('Missing action: '+label);target.props.onClick();
   }
  `,resolveDir:root,loader:'tsx'},
  bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent',define:{'import.meta.env':'{}'},
  plugins:[{name:'headless-surfaces',setup(b){
   // Render portal contents into the static tree; no browser, audio device or event loop is used.
   b.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'portal'}))
   b.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal=(children)=>children;',loader:'js'}))
   b.onResolve({filter:/\.(css|bin|TXT)(\?url)?$/},args=>({path:args.path,namespace:'asset'}))
   b.onLoad({filter:/.*/,namespace:'asset'},()=>({contents:'export default "local-asset"',loader:'js'}))
   b.onLoad({filter:/[\/]src[\/]lib[\/].*\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replaceAll('import.meta.glob','(() => ({}))'),loader:'ts'}))
  }}]
 })
 const output=join(directory,'ui.cjs');writeFileSync(output,result.outputFiles[0].contents);ui=createRequire(import.meta.url)(output)
})
test.after(()=>rmSync(directory,{recursive:true,force:true}))

test('a saved word starts exactly that word, and progress detail is folded',()=>{
 const html=ui.render('saved')
 assert.match(html,/Search my words/)
 assert.match(html,/<details class="trail-word-details">/)
 ui.activate('Practise recalling 法律')
 assert.deepEqual(ui.actions,[['法律']])
})
test('vocabulary keeps secondary filters folded with accessible selectors',()=>{
 const html=ui.render('vocab')
 assert.match(html,/<details class="word-search-filters">/)
 assert.match(html,/aria-label="Vocabulary lesson"/)
 assert.match(html,/aria-label="Search vocabulary"/)
 assert.doesNotMatch(html,/Known-char/)
})
test('short drill defaults to eight words and one pass, with longer settings folded',()=>{
 const html=ui.render('drill',{words:Array.from({length:20},(_,i)=>`word${i}`)})
 assert.match(html,/8 questions in this round/)
 assert.match(html,/The other 12 words stay in your trail/)
 assert.match(html,/<details class="practice-options">/)
 assert.match(html,/aria-pressed="true">1×/)
 assert.doesNotMatch(html,/5×|8×|Every word is asked three ways/)
})
test('one selected word opens the actual recall immediately without a second Start screen',()=>{
 const html=ui.render('drill',{words:['法律']})
 assert.match(html,/<h2>law<\/h2>/)
 assert.match(html,/Skip for now/)
 assert.match(html,/Finish practice/)
 assert.doesNotMatch(html,/Start recall|More practice options|Word progress:/)
})
test('all-caught-up progress continues learning instead of opening an empty review',()=>{
 const html=ui.render('progress')
 assert.match(html,/All caught up. Continue a lesson/)
 assert.match(html,/<details class="progress-activity-details">/)
 ui.activate('Continue learning→')
 assert.deepEqual(ui.actions,['learn'])
})
test('scheduled review offers an unscored skip and a clear reveal without exposing the answer',()=>{
 const html=ui.render('review',{words:['法律']})
 assert.match(html,/Skip for now/)
 assert.match(html,/Show answer/)
 assert.doesNotMatch(html,/>法律<|I need to see it/)
})


test('book source and explanations keep every paragraph in one view with one forward action',()=>{
 const text=Array.from({length:8},(_,i)=>`Paragraph ${i+1} includes a useful source idea.`).join('\n\n')
 const sitting={kind:'idea',titleEn:'Source title',bodyEn:text,terms:[{en:'One',hook:'First cue'},{en:'Two',hook:'Second cue'}]}
 const html=ui.render('reader',{sitting,n:1,of:2,passageKey:'test:reader',onNext(){}})
 for(let i=1;i<=8;i++) assert.match(html,new RegExp('Paragraph '+i+' includes'))
 assert.equal((html.match(/>Continue<\/button>/g)??[]).length,1)
 assert.match(html,/<details class="books-disclosure"><summary>Key terms/)
 assert.doesNotMatch(html,/Next passage|Previous passage|Next key term|Full source passage/)
 const explanation=ui.render('principle',{plan:{principle:{explanation:text,title:'Use the idea'}},onNext(){}})
 assert.match(explanation,/Paragraph 8 includes/)
 assert.doesNotMatch(explanation,/Next passage|Explanation 1 of/)
})


test('Profile reports the actual saved trail count instead of only independently recalled words',()=>{
 const html=ui.render('profile')
 assert.match(html,/2 words in your trail/)
 assert.doesNotMatch(html,/0 words in your trail/)
})
