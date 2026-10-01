class_name Catalog
## 数据目录：角色外观 / 武器 / 技能 / 道具 全部解构，可自由组合。
## 之后要加新内容，只需要在这里添加条目，菜单与战斗逻辑会自动读取。

const CHARS := {
	"blue": {"name": "艾琳", "tex": "res://assets/img/char_blue.png", "tint": Color(0.55, 0.8, 1.0)},
	"orange": {"name": "烈阳", "tex": "res://assets/img/char_orange.png", "tint": Color(1.0, 0.72, 0.42)},
	"violet": {"name": "紫苑", "tex": "res://assets/img/char_violet.png", "tint": Color(0.78, 0.6, 1.0)},
}

const WEAPONS := {
	"blaster": {
		"name": "疾风双枪", "desc": "高射速能量手枪，中距离灵活压制。",
		"damage": 10.0, "interval": 0.14, "speed": 950.0, "range": 480.0,
		"pellets": 1, "spread": 3.0, "size": 7.0,
		"pierce": false, "arc": false, "aoe": 0.0,
		"color": Color(0.49, 0.97, 1.0), "sfx": "shot1", "shake": 2.0,
		"desired_range": 330.0,
	},
	"shotgun": {
		"name": "碎星霰弹", "desc": "一次喷出 6 枚弹丸，近身爆发恐怖。",
		"damage": 8.0, "interval": 0.85, "speed": 820.0, "range": 300.0,
		"pellets": 6, "spread": 13.0, "size": 8.0,
		"pierce": false, "arc": false, "aoe": 0.0,
		"color": Color(1.0, 0.83, 0.43), "sfx": "shot2", "shake": 6.0,
		"desired_range": 170.0,
	},
	"railgun": {
		"name": "苍雷狙击", "desc": "蓄能磁轨弹，超远射程并贯穿敌人。",
		"damage": 46.0, "interval": 1.15, "speed": 1600.0, "range": 700.0,
		"pellets": 1, "spread": 0.5, "size": 10.0,
		"pierce": true, "arc": false, "aoe": 0.0,
		"color": Color(0.78, 0.65, 1.0), "sfx": "shot3", "shake": 7.0,
		"desired_range": 470.0,
	},
	"lobber": {
		"name": "焰心榴弹", "desc": "抛射越过掩体，落点范围爆炸。",
		"damage": 32.0, "interval": 0.95, "speed": 560.0, "range": 460.0,
		"pellets": 1, "spread": 2.0, "size": 9.0,
		"pierce": false, "arc": true, "aoe": 95.0,
		"color": Color(1.0, 0.54, 0.36), "sfx": "lob", "shake": 3.0,
		"desired_range": 320.0,
	},
	"wave": {
		"name": "狂澜波刃", "desc": "挥出巨大的能量波，贯穿一切敌人。",
		"damage": 17.0, "interval": 0.6, "speed": 520.0, "range": 340.0,
		"pellets": 1, "spread": 1.0, "size": 20.0,
		"pierce": true, "arc": false, "aoe": 0.0,
		"color": Color(0.4, 1.0, 0.85), "sfx": "shot3", "shake": 4.0,
		"desired_range": 230.0,
	},
	"swarm": {
		"name": "蜂群飞弹", "desc": "连射 3 枚自动追踪的小飞弹。",
		"damage": 7.5, "interval": 0.72, "speed": 640.0, "range": 540.0,
		"pellets": 3, "spread": 14.0, "size": 6.0,
		"pierce": false, "arc": false, "aoe": 0.0, "homing": true,
		"color": Color(1.0, 0.55, 0.85), "sfx": "shot1", "shake": 2.0,
		"desired_range": 390.0,
	},
}

const SKILLS := {
	"dash": {
		"id": "dash", "name": "疾影瞬步", "desc": "向移动方向瞬身冲刺，期间无敌。", "cd": 5.0,
	},
	"nova": {
		"id": "nova", "name": "烈焰新星", "desc": "以自身为中心爆发烈焰并击退敌人。", "cd": 9.0,
	},
	"heal": {
		"id": "heal", "name": "治愈领域", "desc": "放置治疗法阵，我方站入持续回血。", "cd": 11.0,
	},
	"shield": {
		"id": "shield", "name": "星光护盾", "desc": "展开吸收 60 伤害的护盾，持续 3 秒。", "cd": 10.0,
	},
	"rage": {
		"id": "rage", "name": "血怒觉醒", "desc": "4 秒内射速 +65%、移速 +25%。", "cd": 10.0,
	},
}

const ITEMS := {
	"boots": {"name": "疾行之靴", "desc": "移动速度 +18%", "speed_mult": 1.18},
	"badge": {"name": "猛攻徽章", "desc": "武器伤害 +20%", "dmg_mult": 1.2},
	"amulet": {"name": "生命护符", "desc": "最大生命 +30%", "hp_mult": 1.3},
	"fang": {"name": "吸血之牙", "desc": "造成伤害的 12% 转化为生命", "lifesteal": 0.12},
	"watch": {"name": "时光怀表", "desc": "技能冷却 -30%", "cd_mult": 0.7},
	"armor": {"name": "重甲核心", "desc": "受到的伤害 -15%", "armor_mult": 0.85},
}

const BOT_NAMES := ["小樱", "凯", "雪乃", "阿岚", "美羽", "千夏", "隼人"]

const ULTS := {
	"storm": {"id": "storm", "name": "弹幕风暴", "desc": "向四周旋转喷射三轮环形弹幕。"},
	"meteor": {"id": "meteor", "name": "天降流星", "desc": "轰炸瞄准区域，落下 5 颗爆炸流星。"},
	"wall": {"id": "wall", "name": "磐石壁垒", "desc": "在面前召唤一排临时岩壁，持续 6 秒。"},
	"chrono": {"id": "chrono", "name": "时空牢笼", "desc": "大范围减速敌人 60%，持续 4 秒。"},
}

## 弹幕风暴的子弹参数（供 Projectile 使用）
const ULT_PROJ := {
	"damage": 11.0, "interval": 0.1, "speed": 720.0, "range": 430.0,
	"pellets": 1, "spread": 0.0, "size": 8.0,
	"pierce": false, "arc": false, "aoe": 0.0,
	"color": Color(1.0, 0.85, 0.35), "sfx": "shot1", "shake": 0.0,
	"desired_range": 300.0,
}

const MAPS := {
	"grass": {
		"name": "苍翠竞技场", "desc": "经典草原：草丛密布，适合伏击。",
		"ground": "res://assets/img/grass_tile.png",
		"wall": "res://assets/img/wall.png",
		"rows": [
			"WWWWWWWWWWWWWWWWWWWWWWWW",
			"W1....B........B.....2.W",
			"W..BB...C..WW..C..BB...W",
			"W......W........W......W",
			"W..C...W..BBBB..W..C...W",
			"W......................W",
			"W.BB..WW..C..C..WW..BB.W",
			"W3.........WW.........4W",
			"W.BB..WW..C..C..WW..BB.W",
			"W......................W",
			"W..C...W..BBBB..W..C...W",
			"W......W........W......W",
			"W..BB...C..WW..C..BB...W",
			"W5....B........B.....6.W",
			"WWWWWWWWWWWWWWWWWWWWWWWW",
		],
	},
	"lava": {
		"name": "熔岩峡谷", "desc": "岩浆灼烧地面，走位失误代价惨重。",
		"ground": "res://assets/img/lava_tile.png",
		"wall": "res://assets/img/lava_wall.png",
		"rows": [
			"WWWWWWWWWWWWWWWWWWWWWWWW",
			"W1.....C......C......2.W",
			"W..BB......WW......BB..W",
			"W....W..L......L..W....W",
			"W.C..W............W..C.W",
			"W........LL..LL........W",
			"W..W..BB........BB..W..W",
			"W3....L....CC....L....4W",
			"W..W..BB........BB..W..W",
			"W........LL..LL........W",
			"W.C..W............W..C.W",
			"W....W..L......L..W....W",
			"W..BB......WW......BB..W",
			"W5.....C......C......6.W",
			"WWWWWWWWWWWWWWWWWWWWWWWW",
		],
	},
}

const MODES := {
	"ffa": {"name": "独狼乱斗", "desc": "6 人混战，3 分钟内击杀最多者获胜"},
	"gems": {"name": "宝石争夺", "desc": "3v3 组队，夺取 10 颗宝石并坚守 15 秒"},
}
