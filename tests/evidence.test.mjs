import test from 'node:test';
import assert from 'node:assert/strict';
import {scoredEvidenceEntities} from '../lib/evidence.ts';
const id='9A62B37E-9A6D-47DA-A6FD-9414FA7F7710';
test('unknown signal warning cannot turn a generic result list into evidence',()=>{
 assert.throws(()=>scoredEvidenceEntities({warnings:[{type:'not_found','signal.interests.entities':[id]}],results:{entities:[{entity_id:'record',query:{affinity:.99}}]}},id),/UNSCORABLE_SIGNAL/);
});
test('entities without finite affinity are never treated as culturally scored',()=>{
 const r=scoredEvidenceEntities({results:{entities:[{entity_id:'generic',query:{}},{entity_id:'valid',query:{affinity:.8}},{entity_id:'invalid',query:{affinity:NaN}}]}},id);
 assert.deepEqual(r.map(x=>x.entity_id),['valid']);
});
test('unrelated explainability warnings preserve valid affinity evidence',()=>{
 const r=scoredEvidenceEntities({warnings:[{type:'explainability_not_available'}],results:{entities:[{entity_id:'valid',query:{affinity:0}}]}},id);assert.equal(r.length,1);
});
test('duplicate upstream artist rows do not double-count one audience anchor',()=>{
 const r=scoredEvidenceEntities({results:{entities:[{entity_id:'abc',query:{affinity:.9}},{entity_id:'ABC',query:{affinity:.8}}]}},id);assert.equal(r.length,1);assert.equal(r[0].query.affinity,.9);
});
