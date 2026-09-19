# 免疫对决 · 病毒 vs 免疫系统(Immune Duel)

Godot 4.7 制作的 3D 1v1 游戏:**你扮演一个病毒**,在血流中感染细胞,
对抗巨噬细胞与浆细胞的免疫系统防线。目标:感染 **100%** 的细胞。

当前实现:DESIGN.md §8 定义的 demo 切片(M0 + M1 + M2)。

## 玩法(当前 demo)

| 操作 | 说明 |
| --- | --- |
| `W A S D` / 方向键 | 相对镜头方向游动 |
| `Q` / `E` | 旋转镜头 |
| 鼠标滚轮 | 缩放 |
| `R` | 结算后重新开始 |

- **感染**:贴近健康细胞停留 ~1.1s 注射 → 细胞变紫(感染) → 5s 后**裂解**,放出 4 个**子代病毒**
- **子代自动感染**:子代自动索敌最近健康细胞,继续感染 → 链式反应
- **胜利**:100% 细胞被感染;**失败**:被巨噬细胞吞噬 3 次(HP ×3)
- **巨噬细胞 ×2**:游走巡逻,**优先吞噬被抗体标记的目标**,其次就近吃病毒
- **浆细胞 ×1**:保持距离,发射 **Y 形抗体** → 命中减速 50% 并叠加"标记"(红色光环,层数越高越危险)
- **血流场**:全场解析旋涡 + 湍流场,细胞 / 碎片随血流漂移

## 在浏览器试玩

```bash
python3 tools/make_build.py     # 打包 PCK + 组装 build/web/
python3 tools/serve.py 8000     # http://localhost:8000
```

无头冒烟测试(无需浏览器,用 Web 模板运行时 + Node 直接跑游戏):

```bash
node tools/smoke.mjs build/web   # AI 自动游玩,验证 感染/裂解/子代/抗体/吞噬 全链路
```

## 目录结构

```
project.godot          Godot 4.7 工程(gl_compatibility 渲染,Web 友好)
scenes/main.tscn       入口场景(全部内容代码生成)
scripts/*.gd           游戏逻辑(main 编排 + 各实体)
assets/NotoSansSC-*    中文字体子集(运行时经 FontFile.data 加载,免导入)
web/shell.html         自定义 Web 引导页(官方 Engine 引导协议)
web/vendor/            Godot 4.7.2 官方 Web 模板运行时(nothreads)
tools/make_build.py    GDPC v4 PCK 打包器 + 构建组装
tools/serve.py         静态服务器(正确的 wasm MIME + 浏览器日志回传)
tools/smoke.mjs        无头冒烟测试(Node + wasm 运行时)
export_presets.cfg     Web 导出预设(线程支持 = 关)
```

## 关于构建管线(为什么不用编辑器导出)

本沙箱网络屏蔽了 GitHub release CDN(无法下载 Godot 编辑器二进制与官方导出模板包),
因此本工程改用等效管线:

1. **PCK**:`tools/make_build.py` 按 Godot 4.7 `EditorExportPlatform::save_pack` /
   `PackedSourcePCK` 的 GDPC v4 格式逐字节打包(全部资源为程序化生成,无导入资产,
   等价于 `--headless --export-pack`)。
2. **运行时**:`web/vendor/` 内是 **Godot 4.7.2 官方 Web 模板**
   (`template_release.wasm32.nothreads`,即"线程支持: 关"的官方产物,取自 npm 镜像)。
3. **引导**:`web/shell.html` 复刻官方 `Engine.startGame` 引导协议
   (`Godot(modCfg)` → `initFS` → `initConfig` → `copyToFS` → `callMain(['--main-pack', ...])`)。

在本地装有 Godot 4.7 编辑器的机器上,直接
`godot --headless --export-release "Web" build/index.html` 也能得到同样可玩的结果。

## 字体许可

`assets/NotoSansSC-Regular.ttf` 为 Google Noto Sans SC 子集,OFL 许可,
见 `assets/NotoSansSC-LICENSE.txt`。
