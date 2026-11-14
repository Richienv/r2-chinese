import test from 'node:test'
import assert from 'node:assert/strict'
import {speak,setClipResolver,stopSpeech} from '../src/lib/speech.ts'
test('recording playback waits for metadata and a completed seek before making sound',async()=>{
 const keys=['Audio','window','document','requestAnimationFrame','cancelAnimationFrame'],prior=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),played=[]
 class Media extends EventTarget{
  src='';readyState=0;seeking=false;position=0
  setAttribute(){}
  get currentTime(){return this.position}
  set currentTime(value){this.seeking=true;setTimeout(()=>{this.position=value;this.seeking=false;this.dispatchEvent(new Event('seeked'))},5)}
  load(){setTimeout(()=>{this.readyState=4;this.dispatchEvent(new Event('loadedmetadata'))},5)}
  play(){played.push(this.currentTime);setTimeout(()=>{this.position=63;this.dispatchEvent(new Event('ended'))},5);return Promise.resolve()}
  pause(){}
 }
 globalThis.Audio=Media;globalThis.window={speechSynthesis:{cancel(){}}};globalThis.document={body:{appendChild(){}}}
 globalThis.requestAnimationFrame=fn=>setTimeout(fn,1);globalThis.cancelAnimationFrame=clearTimeout
 setClipResolver(()=>({url:'/audio/recording.mp3',start:62.09,end:62.94,words:[],fail(){throw Error('must not fall back')}}))
 try{assert.equal(await speak('法律'),true);assert.deepEqual(played,[62.09])}
 finally{stopSpeech();setClipResolver(()=>null);for(const k of keys){if(prior[k]===undefined)delete globalThis[k];else globalThis[k]=prior[k]}}
})
