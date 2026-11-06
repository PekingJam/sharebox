/**
 * API 冒烟测试：先启动服务，再运行
 *   ADMIN_PASSWORD=test123456 pnpm test:api
 */
import assert from 'node:assert/strict'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'test123456'

let cookie = ''
let passed = 0

function ok(label) {
  passed += 1
  console.log(`  ✓ ${label}`)
}

async function request(path, options = {}) {
  const { method = 'GET', json, form, headers = {} } = options
  const finalHeaders = { ...headers }
  if (cookie) finalHeaders.cookie = cookie
  let body
  if (json !== undefined) {
    finalHeaders['content-type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  const response = await fetch(`${BASE}${path}`, { method, headers: finalHeaders, body })
  const setCookies = response.headers.getSetCookie?.() ?? []
  if (setCookies.length > 0) {
    cookie = setCookies.map((item) => item.split(';')[0]).join('; ')
  }
  return response
}

async function jsonOf(response) {
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('application/json')) return response.json()
  return response.text()
}

async function expectJson(path, expectedStatus, options) {
  const response = await request(path, options)
  const data = await jsonOf(response)
  assert.equal(
    response.status,
    expectedStatus,
    `${path} 期望 ${expectedStatus}，实际 ${response.status}：${JSON.stringify(data)}`,
  )
  return data
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

console.log(`\n轻传 API 冒烟测试 → ${BASE}\n`)

// 基础接口
const health = await expectJson('/api/health', 200)
assert.equal(health.ok, true)
ok('健康检查')

const siteConfig = await expectJson('/api/config', 200)
assert.equal(siteConfig.siteName, '轻传')
assert.equal(typeof siteConfig.maxUploadMb, 'number')
ok('站点配置')

// 未登录访问后台
await expectJson('/api/admin/shares', 401)
ok('未登录访问后台返回 401')

// 提取码错误
await expectJson('/api/unlock', 400, { method: 'POST', json: { code: 'abc' } })
ok('提取码格式校验')
await expectJson('/api/unlock', 404, { method: 'POST', json: { code: 'ZZZZZZ' } })
ok('不存在的提取码')

// 登录
await expectJson('/api/admin/login', 401, { method: 'POST', json: { password: 'wrong-password' } })
ok('错误密码被拒绝')
await expectJson('/api/admin/login', 200, { method: 'POST', json: { password: PASSWORD } })
assert.ok(cookie.startsWith('sb_session='))
ok('管理员登录并写入会话 Cookie')
await expectJson('/api/admin/me', 200)
ok('会话校验')

// 免登录创建公开文本分享
const publicShare = await expectJson('/api/shares/text', 201, {
  method: 'POST',
  json: {
    title: '公开文本',
    content: '# 公开分享\n\n无需登录即可创建文本。\n',
    expiresIn: '1d',
    maxDownloads: 5,
  },
})
assert.equal(publicShare.kind, 'text')
const publicUnlock = await expectJson('/api/unlock', 200, {
  method: 'POST',
  json: { code: publicShare.code },
})
assert.match(publicUnlock.text, /公开分享/)
ok('免登录创建并提取公开文本')

// 创建文本分享
const textShare = await expectJson('/api/admin/shares', 201, {
  method: 'POST',
  json: {
    title: 'Markdown 测试',
    content: '# 标题\n\n**加粗** 文本\n\n```js\nconsole.log(1)\n```\n',
    expiresIn: '1d',
    maxDownloads: 2,
  },
})
assert.equal(textShare.kind, 'text')
assert.equal(textShare.code.length, 6)
ok('创建文本分享')

const listed = await expectJson('/api/admin/shares?q=Markdown', 200)
assert.ok(listed.total >= 1)
const listedItem = listed.items.find((item) => item.code === textShare.code)
assert.ok(listedItem, '列表中应包含刚创建的分享')
assert.equal(listedItem.status, 'active')
ok('后台搜索与列表')

const stats = await expectJson('/api/admin/stats', 200)
assert.ok(stats.totalShares >= 1)
assert.ok(stats.totalDownloads >= 0)
ok('统计接口')

// 提取文本（次数限制）
const unlock1 = await expectJson('/api/unlock', 200, { method: 'POST', json: { code: textShare.code.toLowerCase() } })
assert.equal(unlock1.share.kind, 'text')
assert.match(unlock1.text, /^# 标题/)
assert.equal(unlock1.share.remainingDownloads, 1)
ok('提取文本（大小写不敏感）')

const unlock2 = await expectJson('/api/unlock', 200, { method: 'POST', json: { code: textShare.code } })
assert.equal(unlock2.share.remainingDownloads, 0)
ok('第二次提取，剩余次数归零')
await expectJson('/api/unlock', 410, { method: 'POST', json: { code: textShare.code } })
ok('次数用尽后拒绝提取')

// 阅后即焚文本
const burnShare = await expectJson('/api/admin/shares', 201, {
  method: 'POST',
  json: { title: '一次性文本', content: 'secret', expiresIn: '1h', burnAfterRead: true },
})
const burned = await expectJson('/api/unlock', 200, { method: 'POST', json: { code: burnShare.code } })
assert.equal(burned.text, 'secret')
await expectJson('/api/unlock', 404, { method: 'POST', json: { code: burnShare.code } })
ok('阅后即焚文本被立即销毁')

// 上传文件
const form = new FormData()
form.append('title', '文件测试')
form.append('expiresIn', '1d')
form.append('maxDownloads', '3')
form.append('burnAfterRead', 'false')
form.append('files', new Blob([Buffer.from('hello 世界')], { type: 'text/plain' }), '说明.txt')
form.append('files', new Blob([PNG_1X1], { type: 'image/png' }), '图片.png')
const fileShare = await expectJson('/api/admin/shares/files', 201, { method: 'POST', form })
assert.equal(fileShare.kind, 'files')
assert.equal(fileShare.fileCount, 2)
assert.ok(fileShare.totalSize > 0)
ok('多文件上传')

const fileUnlock = await expectJson('/api/unlock', 200, { method: 'POST', json: { code: fileShare.code } })
assert.equal(fileUnlock.files.length, 2)
assert.ok(fileUnlock.token)
const textFile = fileUnlock.files.find((file) => file.name === '说明.txt')
const imageFile = fileUnlock.files.find((file) => file.name === '图片.png')
assert.ok(textFile && imageFile)
ok('提取文件列表与下载令牌')

// 内联预览与下载
const inlineText = await request(`/api/files/${textFile.id}?token=${encodeURIComponent(fileUnlock.token)}`)
assert.equal(inlineText.status, 200)
assert.match(inlineText.headers.get('content-disposition') ?? '', /^inline;/)
assert.equal(await inlineText.text(), 'hello 世界')
ok('文本文件内联预览')

const forcedDownload = await request(
  `/api/files/${textFile.id}?token=${encodeURIComponent(fileUnlock.token)}&download=1`,
)
assert.equal(forcedDownload.status, 200)
assert.match(forcedDownload.headers.get('content-disposition') ?? '', /^attachment;/)
assert.equal(forcedDownload.headers.get('content-type'), 'application/octet-stream')
ok('强制下载')

const imageDownload = await request(
  `/api/files/${imageFile.id}?token=${encodeURIComponent(fileUnlock.token)}`,
)
assert.equal(imageDownload.status, 200)
assert.equal(imageDownload.headers.get('content-type'), 'image/png')
assert.match(imageDownload.headers.get('content-disposition') ?? '', /^inline;/)
const imageBytes = Buffer.from(await imageDownload.arrayBuffer())
assert.equal(imageBytes[0], 0x89)
ok('图片内联预览')

const noToken = await request(`/api/files/${textFile.id}`)
assert.equal(noToken.status, 401)
ok('缺少令牌无法下载')

const zipResponse = await request(
  `/api/shares/${fileShare.id}/zip?token=${encodeURIComponent(fileUnlock.token)}`,
)
assert.equal(zipResponse.status, 200)
assert.match(zipResponse.headers.get('content-type') ?? '', /application\/zip/)
const zipBytes = Buffer.from(await zipResponse.arrayBuffer())
assert.equal(zipBytes[0], 0x50)
assert.equal(zipBytes[1], 0x4b)
ok('打包下载 ZIP')

// HTML 只能作为附件下载，避免 XSS
const htmlForm = new FormData()
htmlForm.append('title', '危险文件')
htmlForm.append('expiresIn', '1d')
htmlForm.append(
  'files',
  new Blob([Buffer.from('<script>alert(1)</script>')], { type: 'text/html' }),
  'xss.html',
)
const htmlShare = await expectJson('/api/admin/shares/files', 201, { method: 'POST', form: htmlForm })
const htmlUnlock = await expectJson('/api/unlock', 200, { method: 'POST', json: { code: htmlShare.code } })
const htmlFile = htmlUnlock.files[0]
const htmlDownload = await request(
  `/api/files/${htmlFile.id}?token=${encodeURIComponent(htmlUnlock.token)}`,
)
assert.equal(htmlDownload.headers.get('content-type'), 'application/octet-stream')
assert.match(htmlDownload.headers.get('content-disposition') ?? '', /^attachment;/)
ok('HTML 文件强制以附件下载')

// 删除
await expectJson(`/api/admin/shares/${htmlShare.id}`, 200, { method: 'DELETE' })
await expectJson('/api/unlock', 404, { method: 'POST', json: { code: htmlShare.code } })
ok('删除分享并同步清理文件')

// 修改密码
await expectJson('/api/admin/password', 200, {
  method: 'POST',
  json: { currentPassword: PASSWORD, newPassword: 'newpass12345' },
})
await expectJson('/api/admin/login', 401, { method: 'POST', json: { password: PASSWORD } })
ok('修改密码后旧密码失效')
await expectJson('/api/admin/login', 200, { method: 'POST', json: { password: 'newpass12345' } })
ok('新密码可以登录')
await expectJson('/api/admin/password', 200, {
  method: 'POST',
  json: { currentPassword: 'newpass12345', newPassword: PASSWORD },
})
ok('恢复测试密码')

// 登出
await expectJson('/api/admin/logout', 200, { method: 'POST' })
await expectJson('/api/admin/me', 401)
ok('退出登录')

// 限流（最后执行）
let limited = false
for (let i = 0; i < 24; i += 1) {
  const response = await request('/api/unlock', {
    method: 'POST',
    json: { code: `AAAAA${String.fromCharCode(65 + (i % 26))}` },
  })
  if (response.status === 429) {
    limited = true
    break
  }
  await response.arrayBuffer()
}
assert.equal(limited, true, '连续尝试应触发 429 限流')
ok('提取码暴力尝试被限流')

console.log(`\n全部通过：${passed} 项检查\n`)
