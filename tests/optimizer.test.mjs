import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeInventory,rankFit} from '../lib/optimizer.ts';
const base={count:3,maxPrice:40,minMargin:.25,minFit:.2,prioritizeAge:true};
const item=(sku,overrides={})=>({sku,artist:sku,title:sku,price:30,cost:15,quantity:2,daysOnShelf:100,genre:'Jazz',...overrides});
const ev=(rank,n=5)=>[{anchorId:'signal',anchorName:'Film',rank,poolSize:n,score:.9,rankFit:rankFit(rank,n),fetchedAt:'2026-10-20T00:00:00Z',cached:false}];
test('hard constraints reject stale mismatched stock, zero stock, bad margin and excessive price',()=>{
 const stock=[item('fit'),item('old',{daysOnShelf:900}),item('zero',{quantity:0}),item('loss',{cost:28}),item('price',{price:41})];
 const evidence=new Map(stock.map((i,n)=>[i.sku,ev(n===1?5:1)]));
 const run=optimizeInventory(stock,evidence,1,base);
 assert.deepEqual(run.selected.map(i=>i.sku),['fit']);
 assert.deepEqual(run.items.filter(i=>!i.selected).map(i=>i.exclusion),['Below cultural rank-fit floor','Out of stock','Below gross margin floor','Above per-record price cap']);
});
test('raw normalized affinity cannot override rank evidence',()=>{
 const first=ev(1);first[0].score=.01;
 const last=ev(5);last[0].score=.99;
 const r=optimizeInventory([item('a'),item('b')],new Map([['a',first],['b',last]]),1,{...base,count:1});
 assert.equal(r.selected[0].sku,'a');
});
test('missing anchor evidence contributes zero rather than overstating consensus',()=>{
 const r=optimizeInventory([item('a')],new Map([['a',ev(1)]]),2,base);
 assert.equal(r.selected[0].fit,.5);
});
test('one artist per collection even across aliases resolved to same ID',()=>{
 const stock=[item('a',{artist:'Alias A',entityId:'same'}),item('b',{artist:'Alias B',entityId:'same'})];
 const r=optimizeInventory(stock,new Map(stock.map(i=>[i.sku,ev(1)])),1,base);
 assert.equal(r.selected.length,1);
 assert.equal(r.items.find(i=>!i.selected).exclusion,'Artist already represented');
});
test('no evidence never becomes a fabricated recommendation even at zero fit floor',()=>{
 const r=optimizeInventory([item('a')],new Map(),1,{...base,minFit:0});
 assert.equal(r.selected.length,0);
 assert.equal(r.items[0].exclusion,'No Qloo affinity returned for this artist');
});
test('economics use one copy of each record and exact cent boundaries',()=>{
 const stock=[item('a',{price:19.99,cost:9.99,quantity:100}),item('b',{price:20.01,cost:10.01})];
 const r=optimizeInventory(stock,new Map(stock.map(i=>[i.sku,ev(1)])),1,base);
 assert.deepEqual(r.economics,{retail:40,cost:20,contribution:20,margin:.5,agedUnits:2});
});
test('relative rank endpoints and singleton remain bounded',()=>{
 assert.equal(rankFit(1,20),1);assert.equal(rankFit(20,20),0);assert.equal(rankFit(1,1),1);
});
test('infeasible requested count returns fewer results without relaxing margin',()=>{
 const r=optimizeInventory([item('a',{cost:29})],new Map([['a',ev(1)]]),1,base);
 assert.equal(r.selected.length,0);
});
