import assert from 'node:assert/strict'
import { prepareChatImage, ChatImagePreparationError } from '../../../../src/utils/prepare-chat-image'

let encodeNull = false
let width = 0, height = 0
const revoked: string[] = []
URL.createObjectURL = () => 'blob:source'
URL.revokeObjectURL = url => { revoked.push(url) }
class FakeImage {
  naturalWidth = 2560
  naturalHeight = 1920
  onload = () => {}
  set src(_url: string) { this.onload() }
}
Object.defineProperty(globalThis, 'Image', { value: FakeImage, configurable: true })
Object.defineProperty(globalThis, 'document', { value: { createElement: () => ({
  set width(value: number) { width = value }, set height(value: number) { height = value },
  getContext: () => ({ drawImage: () => {} }),
  toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
    assert.equal(type, 'image/jpeg'); assert.equal(quality, 0.82)
    callback(encodeNull ? null : new Blob(['encoded'], { type }))
  },
}) }, configurable: true })
const file = new File(['source'], 'photo.png', { type: 'image/png' })
const prepared = await prepareChatImage(file)
assert.equal(width, 1280); assert.equal(height, 960)
assert.equal(prepared.type, 'image/jpeg'); assert.equal(prepared.name, 'photo.jpg')
assert.equal(await prepared.text(), 'encoded')
encodeNull = true
await assert.rejects(prepareChatImage(file), ChatImagePreparationError)
assert.deepEqual(revoked, ['blob:source', 'blob:source'])
console.log('chat image preparation dry test passed')
