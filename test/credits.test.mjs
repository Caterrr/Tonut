import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resetCreditsFromResponse,quotaFromResponse} from '../src/quota.mjs';
import {DONUT_SVG} from '../src/donut.mjs';
test('SVG is editable source with exactly matching generated runtime, no external resources',()=>{assert.equal(DONUT_SVG,readFileSync(new URL('../assets/tonut-donut.svg',import.meta.url),'utf8').trim());assert.doesNotMatch(DONUT_SVG,/<script|href=|https?:\/\/(?!www.w3.org)/);assert.match(DONUT_SVG,/<rect/);});
test('unknown reset credits remain unknown; zero is only accepted from authoritative count',()=>{for(const r of [null,{}, {rateLimitResetCredits:{availableCount:null}}, {rateLimitResetCredits:{availableCount:-1}},{rateLimitResetCredits:{availableCount:'2'}}])assert.equal(resetCreditsFromResponse(r),null);assert.deepEqual(resetCreditsFromResponse({rateLimitResetCredits:{availableCount:0}}),{availableCount:0});});
test('credit count is authoritative even when detail rows are missing/capped; IDs and titles stripped',()=>{const r={rateLimitResetCredits:{availableCount:2,credits:[{id:'private opaque id',title:'not forwarded',status:'available',resetType:'codexRateLimits',expiresAt:2000000},{id:'expired',status:'available',resetType:'codexRateLimits',expiresAt:1},{id:'used',status:'used',resetType:'codexRateLimits',expiresAt:2000000}]}};assert.deepEqual(resetCreditsFromResponse(r,1000000),{availableCount:2});assert.doesNotMatch(JSON.stringify(quotaFromResponse(r,10080,1000000)),/opaque|forwarded|expired|used|expiresAt|credits\":/);});
