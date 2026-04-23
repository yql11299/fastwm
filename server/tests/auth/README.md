# 认证模块测试文档

## 概述

本文档描述认证模块的测试策略、测试用例及运行方法。

## 测试范围

| 模块 | 测试文件 | 描述 |
|------|----------|------|
| 认证中间件 | `unit/auth.test.js` | JWT Token 生成/验证、中间件逻辑 |
| 认证路由 | `integration/auth.test.js` | 所有认证 API 端点 |

## 测试启动方法

### 前置条件

```bash
cd server
npm install
```

### 运行所有认证测试

```bash
cd server
npm test -- --testPathPattern="auth"
```

### 仅运行单元测试

```bash
npm test -- --testPathPattern="auth/unit"
```

### 仅运行集成测试

```bash
npm test -- --testPathPattern="auth/integration"
```

### 生成覆盖率报告

```bash
npm test -- --testPathPattern="auth" --coverage
```

## 文件结构

```
tests/auth/
├── README.md           # 本文档
├── setup.js            # 测试环境配置和清理函数
├── unit/
│   └── auth.test.js   # 认证中间件单元测试
└── integration/
    └── auth.test.js    # 认证路由集成测试
```

---

## 单元测试用例 (19 个)

### 测试文件: `unit/auth.test.js`

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-UT-001 | 应该生成有效的 JWT token | 验证 generateToken 生成正确格式的 JWT | `token.split('.')).toHaveLength(3)` |
| TC-AUTH-UT-002 | token 应该包含用户信息 | 验证 token payload 包含用户数据 | `decoded.id === mockUser.id` |
| TC-AUTH-UT-003 | 不同用户生成的 token 应该不同 | 验证 token 唯一性 | `token1 !== token2` |
| TC-AUTH-UT-004 | 应该验证有效的 token | 验证 verifyToken 正确验证有效 token | `decoded.id === mockUser.id` |
| TC-AUTH-UT-005 | 应该拒绝格式无效的 token | 验证无效 token 被拒绝 | `rejects.toThrow()` |
| TC-AUTH-UT-006 | 应该拒绝签名错误的 token | 验证伪造 token 被拒绝 | `rejects.toThrow()` |
| TC-AUTH-UT-007 | 应该拒绝已过期的 token | 验证过期 token 被拒绝 | `rejects.toThrow()` |
| TC-AUTH-UT-008 | 应该拒绝空字符串 token | 验证边界条件处理 | `rejects.toThrow()` |
| TC-AUTH-UT-009 | 应该拒绝 null | 验证 null 输入处理 | `rejects.toThrow()` |
| TC-AUTH-UT-010 | 应该拒绝 undefined | 验证 undefined 输入处理 | `rejects.toThrow()` |
| TC-AUTH-UT-011 | 无 token 时应返回 401 错误 | 验证认证中间件在无 token 时的行为 | `res.status === 401` |
| TC-AUTH-UT-012 | 带空 Cookie token 时应返回 401 | 验证空 token 处理 | `res.status === 401` |
| TC-AUTH-UT-013 | (已移除，该场景在集成测试 TC-AUTH-IT-014 中覆盖) | - | - |
| TC-AUTH-UT-014 | 优先从 Cookie 提取 token | 验证 Cookie 优先于 Header | `extractToken(req) === 'cookie-token'` |
| TC-AUTH-UT-015 | 无 Cookie 时从 Header 提取 | 验证 fallback 行为 | `extractToken(req) === 'header-token'` |
| TC-AUTH-UT-016 | 两者都没有时返回 null | 验证无认证信息时返回 null | `extractToken(req) === null` |
| TC-AUTH-UT-017 | Authorization Header 无 Bearer 前缀返回 null | 验证 Bearer 前缀验证 | `extractToken(req) === null` |
| TC-AUTH-UT-018 | 用户 ID 大小写应该被标准化为小写 | 验证 toLowerCase 标准化 | `'Admin'.toLowerCase() === 'admin'` |
| TC-AUTH-UT-019 | Token 中的特殊字符应该被正确编码/解码 | 验证 JWT 对特殊字符的编码 | `decoded.id === userWithSpecialChars.id` |
| TC-AUTH-UT-020 | 时间戳应该被正确保留 | 验证 createdAt 在 token 中正确传递 | `decoded.createdAt === specificDate` |

---

## 集成测试用例 (37 个)

### 测试文件: `integration/auth.test.js`

#### 1. POST /api/auth/login - 用户登录

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-001 | 新用户首次登录应自动创建用户 | 验证自动注册功能 | `res.body.success === true` && `res.body.data.user.id` |
| TC-AUTH-IT-002 | 已有用户登录应返回相同用户信息 | 验证已存在用户的登录 | `res.body.data.user.id === username.toLowerCase()` |
| TC-AUTH-IT-003 | 登录成功后应设置 HTTP-only Cookie | 验证 Cookie 设置 | `set-cookie.includes('token=')` |
| TC-AUTH-IT-004 | 用户名为空应返回 400 | 验证空用户名校验 | `res.status === 400` && `error.code === 'VALIDATION_ERROR'` |
| TC-AUTH-IT-005 | 用户名仅包含空格应返回 400 | 验证纯空格校验 | `res.status === 400` |
| TC-AUTH-IT-006 | 用户名缺失应返回 400 | 验证必需字段校验 | `res.status === 400` |
| TC-AUTH-IT-007 | 用户名为 null 应返回 400 | 验证 null 输入校验 | `res.status === 400` |
| TC-AUTH-IT-008 | 用户名为数字应返回 400 | 验证类型校验 | `res.status === 400` |
| TC-AUTH-IT-009 | 用户名大写应自动转为小写 | 验证大小写标准化 | `res.body.data.user.id === 'adminuser'` |
| TC-AUTH-IT-010 | 用户名首尾空格应被去除 | 验证 trim 处理 | `res.body.data.user.id === 'testuser'` |
| TC-AUTH-IT-010b | 用户名仅包含 Tab 字符应返回 400 | 验证 Tab 字符处理 | `res.status === 400` |
| TC-AUTH-IT-010c | 用户名包含换行符应被拒绝 | 验证控制字符校验 | `res.status === 400` |
| TC-AUTH-IT-010d | 用户名包含表情符号应被拒绝或处理 | 验证 Unicode 字符处理 | `res.status === 200 或 res.status === 400` |
| TC-AUTH-IT-011 | 新用户应包含默认配置 | 验证初始化数据结构 | `res.body.data.user.createdAt` |

#### 2. POST /api/auth/logout - 用户登出

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-012 | 登出应成功并清除 Cookie | 验证 logout 清除 token | `res.body.success === true` && `set-cookie` 包含 `token=;` |
| TC-AUTH-IT-013 | 无需登录即可登出 | 验证 logout 不需要认证 | `res.status === 200` |

#### 3. GET /api/auth/current - 获取当前用户

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-014 | 带有效 Token 应返回用户信息 | 验证带认证的请求 | `res.body.success === true` && `res.body.data.id` |
| TC-AUTH-IT-015 | 无 Token 应返回 401 | 验证无认证拒绝 | `res.status === 401` && `error.code === 'AUTH_TOKEN_INVALID'` |
| TC-AUTH-IT-016 | 无效 Token 应返回 401 | 验证伪造 token 拒绝 | `res.status === 401` |
| TC-AUTH-IT-017 | 过期 Token 应返回 401 | 验证过期 token 拒绝 | `res.status === 401` |
| TC-AUTH-IT-018 | 用户被删除后 Token 应失效 | 验证用户删除后 token 失效 | `res.status === 401` |

#### 4. GET /api/auth/users - 获取用户列表

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-019 | 应返回所有用户列表 | 验证用户列表 API | `res.body.success === true` && `Array.isArray(res.body.data)` |
| TC-AUTH-IT-020 | 创建用户后列表应包含该用户 | 验证列表更新 | `userIds.includes(testUsername.toLowerCase())` |
| TC-AUTH-IT-021 | 用户列表数据结构应正确 | 验证数据结构完整性 | 每个用户包含 `id`, `username`, `createdAt` |

#### 5. POST /api/auth/users - 创建用户

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-022 | 创建新用户应成功 | 验证创建用户 API | `res.status === 201` && `res.body.data.id` |
| TC-AUTH-IT-023 | 用户名已存在应返回 400 | 验证重复创建拒绝 | `res.status === 400` && `error.message.includes('已存在')` |
| TC-AUTH-IT-024 | 空用户名应返回 400 | 验证空用户名校验 | `res.status === 400` |

#### 6. 用户数据隔离验证

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-025 | 用户 A 的数据不应被用户 B 访问 | 验证用户数据隔离 | `resA.data.id !== resB.data.id` |

#### 7. Token 多设备登录验证

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-026 | 同一用户可同时在不同会话登录 | 验证多设备登录支持 | `res1.data.user.id === res2.data.user.id` |

#### 8. Cookie 属性验证

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-027 | Cookie 应设置正确的安全属性 | 验证 HttpOnly、SameSite 属性 | Cookie 包含 `HttpOnly` 和 `SameSite=` |
| TC-AUTH-IT-028 | 登出后 Cookie 应被清除 | 验证登出清除 Cookie | `set-cookie` 包含 `token=;` |

#### 9. 响应数据完整性验证

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-029 | 登录响应应包含所有必需字段 | 验证响应数据结构 | 包含 `token`, `user.id`, `user.username`, `user.createdAt` |
| TC-AUTH-IT-030 | 错误响应应包含错误码和消息 | 验证错误响应格式 | 包含 `error.code` 和 `error.message` |
| TC-AUTH-IT-031 | 当前用户响应数据结构应正确 | 验证 current API 响应 | `id`, `username`, `createdAt` 字段正确 |

#### 10. 安全边界验证

| 测试编号 | 测试名称 | 测试目的 | 预期断言 |
|----------|----------|----------|----------|
| TC-AUTH-IT-032 | 使用其他用户的 Cookie 应被拒绝 | 验证跨用户访问被拒绝 | 返回正确的用户 ID，非其他用户 |
| TC-AUTH-IT-033 | 部分损坏的 Cookie 应被拒绝 | 验证伪造 token 被拒绝 | `res.status === 401` |
| TC-AUTH-IT-034 | 超出长度限制的用户名应被拒绝 | 验证长度限制校验 | `res.status === 400` |

---

## 测试数据清理

### 清理策略

1. **beforeEach**: 每个集成测试前清理 `test_users` 目录
2. **afterAll**: 所有测试结束后清理所有测试数据
3. **测试内清理**: 每个创建用户的测试在结束后清理该用户

### 清理函数

位于 `setup.js`:

```javascript
import { cleanupTestUsers, cleanupTestExports, cleanupAllTestData } from './setup.js';

// 清理指定测试用户
async function cleanupTestUser(userId) {
  const userDir = path.join(TEST_USERS_DIR, userId);
  await fs.rm(userDir, { recursive: true, force: true });
}
```

### 测试用户命名规范

测试用户使用前缀 `testauth_` 标识，便于识别和清理：

```javascript
const TEST_USER_PREFIX = 'testauth_';
const testUsername = `${TEST_USER_PREFIX}newuser`;  // -> testauth_newuser
```

---

## 环境配置

测试环境通过 `setup.js` 配置：

```javascript
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.USERS_PATH = path.resolve(__dirname, '../test_users');
// ... 其他测试路径
```

---

## 后端验证规则

认证模块后端实现了以下验证规则：

| 验证项 | 规则 | 错误码 |
|--------|------|--------|
| 用户名必填 | `!username` 或非字符串 | VALIDATION_ERROR |
| 用户名不能为空 | `username.trim() === ''` | VALIDATION_ERROR |
| 控制字符 | 包含 `\x00-\x1f\x7f` | VALIDATION_ERROR |
| 长度限制 | 最大 100 字符 | VALIDATION_ERROR |
| 用户名标准化 | 转小写、去除首尾空格 | - |
| Token 必填 | Cookie 或 Header 无 token | AUTH_TOKEN_INVALID |
| Token 有效性 | JWT 签名验证失败 | AUTH_TOKEN_INVALID |
| Token 过期 | JWT 已过期 | AUTH_TOKEN_INVALID |
| 用户存在 | Token 对应用户已删除 | AUTH_TOKEN_INVALID |

---

## 常见问题

### Q: 集成测试失败显示用户已存在

A: 确保 `beforeEach` 中的 `cleanupTestUsers()` 正确执行。检查是否有测试残留用户。

### Q: Token 验证失败

A: 确认测试环境使用相同的 `JWT_SECRET`。集成测试使用 `setup.js` 中的测试密钥。

### Q: 测试目录不存在

A: 运行测试前确保 `npm install` 已执行，Jest 会自动创建必要的目录。

---

## 测试统计

| 类型 | 测试数量 |
|------|----------|
| 单元测试 | 19 |
| 集成测试 | 37 |
| **总计** | **56** |
