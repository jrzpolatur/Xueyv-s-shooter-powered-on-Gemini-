# 雪羽乱斗 · Xueyv Brawl

一款用 **Godot 4.4** 开发的动漫画风英雄射击游戏原型（灵感来自荒野乱斗）。

![genre](https://img.shields.io/badge/engine-Godot%204.4-478cbf) ![style](https://img.shields.io/badge/style-anime%202D-ff69b4)

## 玩法

- **自由配装**：角色外观 × 武器 × 技能 × 道具 完全解构，出战前自由组合，相当于自己拼英雄。
- **两种模式**：
  - **独狼乱斗**：6 人混战 3 分钟，击杀数定排名；
  - **宝石争夺（3v3）**：中央矿井定期产出宝石，全队集满 10 颗并坚守 15 秒获胜，死亡会掉落身上全部宝石。
- **荒野乱斗式机制**：草丛隐身（开火暴露）、可破坏补给箱、治疗球 / 能量方块（击杀掉落清零）、脱战回血、死亡重生保护、队伍阵营配色。

### 当前内容

| 槽位 | 选项 |
|------|------|
| 模式 | 独狼乱斗（6 人 FFA） / 宝石争夺（3v3） |
| 地图 | 苍翠竞技场 / 熔岩峡谷（岩浆持续灼烧） / 随机 |
| 角色 | 艾琳（蓝） / 烈阳（橙） / 紫苑（紫） |
| 武器 | 疾风双枪（速射） / 碎星霰弹（近战爆发） / 苍雷狙击（贯穿） / 焰心榴弹（抛射 AoE） / 狂澜波刃（巨型贯穿波） / 蜂群飞弹（追踪×3） |
| 技能 | 疾影瞬步 / 烈焰新星 / 治愈领域（队友共享） / 星光护盾 / 血怒觉醒 |
| 必杀 | 弹幕风暴 / 天降流星 / 磐石壁垒 / 时空牢笼（输出伤害充能，E 键释放） |
| 道具 | 疾行之靴 / 猛攻徽章 / 生命护符 / 吸血之牙 / 时光怀表 / 重甲核心 |

新内容只需在 `src/catalog.gd` 加一个条目，菜单与战斗逻辑自动读取。

## 操作

- **电脑**：WASD 移动 · 鼠标瞄准 · 左键射击 · 空格 / 右键 技能 · E / Q 必杀
- **手机**：左摇杆移动 · 右摇杆瞄准并射击 · 技能 / 必杀按钮

## 运行

### 本地（Godot 编辑器）

1. 安装 [Godot 4.4+](https://godotengine.org/download)
2. 打开本仓库的 `project.godot`，按 F5 运行

### Web 构建

```bash
godot --headless --path . --import
godot --headless --path . --export-release "Web" build/web/index.html
python3 tools/serve_web.py 8080   # 打开 http://localhost:8080
```

### 无头烟雾测试

```bash
godot --headless --path . -- --smoke                 # 独狼乱斗 / 随机地图
godot --headless --path . -- --smoke --gems --lava   # 宝石争夺 / 熔岩峡谷
```

## 代码结构

```
src/
  catalog.gd    # 全部武器/技能/道具/角色数据（解构配装的核心）
  g.gd          # 自动加载：输入注册、音效、全局状态
  main.gd       # 流程：菜单 ⇄ 战斗
  menu.gd       # 配装菜单
  arena.gd      # 地图构建、比赛逻辑、相机
  unit.gd       # 战斗单位基类（意图驱动）
  player.gd     # 本地输入 → 意图
  bot.gd        # AI 状态机 → 意图
  projectile.gd # 直射/贯穿/抛射统一投射物
  hud.gd        # 战斗 UI + 结算
  joystick.gd   # 触屏虚拟摇杆
tools/
  make_sfx.py   # 程序化生成全部音效
  serve_web.py  # 带 gzip 的 Web 构建服务器
```

### 联机扩展预留

所有单位操作都通过**意图字段**（`move_input / aim_dir / want_fire / want_skill`）驱动，
控制端（本地输入、AI、未来的网络同步）只负责写入意图。做联机时只需：

1. 用 `MultiplayerSynchronizer` 或自定义 RPC 把远端玩家意图写入对应 `Unit`；
2. 服务器权威执行 `unit.gd` 的战斗逻辑并回播状态。

## 美术

角色与场景素材为 AI 生成的动漫风贴图（绿幕/品红幕抠图），中文字体为 Noto Sans SC 子集。
