import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareRun } from '../src/lib/runs';
const base = { request_id: '50cedfdd-920a-4256-b9c3-38f07aa02b76', shape: 'rectangular', parameters: { Q: 5, g: 9.81, y: 1, B: 2, m: 1.5, D: 2 }, tolerance: 1e-8 };
test('recomputes the README rectangular reference', () => { const run = prepareRun(base); assert.ok(Math.abs(run.results.criticalDepth - .860) < .001); assert.ok(Math.abs(run.results.froude - .798) < .001); assert.equal(run.results.flowRegime, 'SUBCRITICAL'); });
test('all four geometries converge', () => { for (const shape of ['rectangular','triangular','trapezoidal','circular']) assert.equal(prepareRun({...base,shape}).results.ok,true); });
test('rejects invalid or spoofed inputs', () => { for (const input of [{...base, user_id:'other'}, {...base,results:{froude:0}}, {...base,shape:'square'}, {...base, parameters:{...base.parameters,Q:0}}, {...base, parameters:{...base.parameters,g:Infinity}}, {...base,shape:'circular',parameters:{...base.parameters,y:3}}, {...base,tolerance:.01}, {...base,request_id:'bad'}]) assert.throws(() => prepareRun(input)); });
