import assert from 'node:assert/strict'
import { AGENTS, agentById, agentVisibleToRole } from '../../../../../src/features/agents/agents.ts'

const visible = (role: 'admin' | 'staff' | 'device' | null) => AGENTS.filter(agent => agentVisibleToRole(agent, role)).map(agent => agent.id)

assert.ok(visible('admin').includes('appointments') && visible('admin').includes('washing') && visible('admin').includes('ironing'))
assert.deepEqual(visible('staff').filter(id => ['appointments', 'washing', 'ironing'].includes(id)), ['appointments', 'washing', 'ironing'])
assert.deepEqual(visible('device').filter(id => ['appointments', 'washing', 'ironing'].includes(id)), [])
assert.deepEqual(visible(null).filter(id => ['appointments', 'washing', 'ironing'].includes(id)), [])
assert.equal(agentById('washing').name, 'น้องซักผ้า')
assert.equal(agentById('ironing').name, 'น้องรีดผ้า')
assert.equal(agentById('personal').name, 'ผู้ช่วยส่วนตัว')
assert.equal(agentById('personal').role, 'My assistant')
assert.ok(visible('admin').includes('personal') && visible('staff').includes('personal'))
assert.ok(!visible('device').includes('personal') && !visible(null).includes('personal'))
console.log('agents.dry-test: OK')
