# 故障排除指南

## Vercel 构建错误

### 1. 构建失败但没有完整错误信息

如果构建在 `npm run build` 阶段失败，请检查：

#### 检查 TypeScript 编译错误

在本地运行：
```bash
npm run build
```

查看完整的错误信息。常见问题：

- **类型错误**: 检查 `tsconfig.json` 配置
- **导入错误**: 确保所有依赖都已安装
- **语法错误**: 检查代码中是否有语法问题

#### 检查环境变量

确保在 Vercel 中设置了必要的环境变量：

**最小配置（OpenRouter）:**
```
API_PROVIDER=openrouter
API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

**完整配置（ZenMux）:**
```
API_PROVIDER=zenmux
API_KEY=sk-or-v1-xxxxxxxxxxxxx
ZENMUX_API_KEY=your-zenmux-api-key
```

### 2. 环境变量未生效

**问题**: 代码中访问 `process.env.XXX` 返回 `undefined`

**解决方案**:
1. 在 Vercel 中检查环境变量是否正确设置
2. 确保环境变量名称拼写正确（区分大小写）
3. 重新部署应用
4. 检查构建日志，查看 `[Vite Config]` 开头的日志

### 3. TypeScript 编译错误

**问题**: `process.env` 类型错误

**解决方案**: 
- 已更新 `vite-env.d.ts` 包含所有环境变量类型
- 代码中使用 `@ts-ignore` 注释来避免类型检查
- 如果仍有问题，检查 `tsconfig.json` 中的 `types` 配置

### 4. 构建超时

**问题**: 构建过程超时

**解决方案**:
- 检查网络连接
- 减少依赖包大小
- 检查是否有循环依赖

### 5. 运行时错误

**问题**: 应用部署成功但运行时出错

**检查清单**:
- [ ] API Key 是否正确设置
- [ ] API_PROVIDER 是否正确（`openrouter` 或 `zenmux`）
- [ ] 浏览器控制台是否有错误信息
- [ ] 网络请求是否成功

## 本地测试构建

在提交到 Vercel 之前，建议先在本地测试构建：

```bash
# 安装依赖
npm install

# 运行类型检查
npx tsc --noEmit

# 构建项目
npm run build

# 预览构建结果
npm run preview
```

## 查看完整构建日志

在 Vercel 中：
1. 进入项目 Dashboard
2. 点击失败的部署
3. 查看 "Build Logs" 标签
4. 查找错误信息（通常在最后几行）

## 常见错误信息

### "Cannot find name 'process'"

**原因**: 浏览器环境中 `process` 不存在

**解决**: 已通过 Vite 的 `define` 配置解决，确保 `vite.config.ts` 中正确配置了 `define`

### "API_KEY is missing"

**原因**: 环境变量未正确设置

**解决**: 
1. 检查 Vercel 环境变量
2. 确保变量名称正确
3. 重新部署

### "Invalid API key format"

**原因**: OpenRouter API Key 格式不正确

**解决**: 
- OpenRouter API Key 必须以 `sk-or-v1-` 开头
- 检查是否复制了完整的 Key

## 获取帮助

如果问题仍然存在：

1. 检查 Vercel 构建日志的完整输出
2. 在本地运行 `npm run build` 查看详细错误
3. 检查 GitHub Issues 或提交新的 Issue

## 验证修复

修复后，验证步骤：

1. ✅ 本地构建成功: `npm run build`
2. ✅ 本地预览正常: `npm run preview`
3. ✅ Vercel 构建成功
4. ✅ 应用正常运行
5. ✅ API 调用成功（检查浏览器控制台）

