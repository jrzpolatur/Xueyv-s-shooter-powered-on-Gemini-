#!/usr/bin/env python3
"""Procedurally generate the game's retro-ish SFX as wav files."""
import math
import os
import random
import struct
import wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sfx")
random.seed(7)


def save(name, samples):
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32000)) for s in samples
        )
        w.writeframes(frames)
    print("wrote", name, len(samples) / SR, "s")


def env(i, n, attack=0.005, curve=5.0):
    t = i / n
    a = min(1.0, (i / SR) / max(attack, 1e-5))
    return a * math.exp(-curve * t)


def sweep(dur, f0, f1, wave_fn, curve=5.0, amp=0.6):
    n = int(SR * dur)
    out = []
    ph = 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        ph += 2 * math.pi * f / SR
        out.append(amp * env(i, n, curve=curve) * wave_fn(ph))
    return out


def sq(ph):
    return 1.0 if math.sin(ph) > 0 else -1.0


def saw(ph):
    return 2.0 * ((ph / (2 * math.pi)) % 1.0) - 1.0


def noise_burst(dur, lp=0.4, curve=6.0, amp=0.7, thump=0.0):
    n = int(SR * dur)
    out = []
    last = 0.0
    for i in range(n):
        v = random.uniform(-1, 1)
        last = last + lp * (v - last)
        s = last * amp * env(i, n, curve=curve)
        if thump > 0:
            s += thump * env(i, n, curve=4.0) * math.sin(2 * math.pi * 58 * i / SR)
        out.append(s)
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    out = [0.0] * n
    for p in parts:
        for i, s in enumerate(p):
            out[i] += s
    return out


def tone_seq(notes, dur, wave_fn=math.sin, amp=0.5, curve=4.0):
    out = []
    for f in notes:
        n = int(SR * dur)
        ph = 0.0
        for i in range(n):
            ph += 2 * math.pi * f / SR
            out.append(amp * env(i, n, curve=curve) * wave_fn(ph))
    return out


# 疾风双枪：轻快哔
save("shot1", sweep(0.09, 980, 520, sq, curve=6.0, amp=0.35))
# 霰弹：砰 + 噪声
save("shot2", mix(noise_burst(0.22, lp=0.5, curve=7.0, amp=0.65, thump=0.5),
                  sweep(0.1, 300, 90, math.sin, curve=6.0, amp=0.5)))
# 磁轨狙击：锐利滑落
save("shot3", mix(sweep(0.3, 1600, 160, saw, curve=6.5, amp=0.4),
                  sweep(0.12, 2400, 900, math.sin, curve=8.0, amp=0.25)))
# 榴弹发射：噗
save("lob", sweep(0.14, 260, 480, math.sin, curve=4.0, amp=0.5))
# 爆炸
save("boom", noise_burst(0.5, lp=0.18, curve=5.0, amp=0.85, thump=0.9))
# 受击
save("hit", noise_burst(0.06, lp=0.7, curve=9.0, amp=0.5))
# 箱子碎裂
save("crate", noise_burst(0.16, lp=0.45, curve=7.0, amp=0.55, thump=0.2))
# 死亡：下行琶音
save("death", tone_seq([392, 311, 233, 155], 0.12, sq, amp=0.3, curve=3.5))
# 拾取：上行叮
save("pickup", tone_seq([660, 990, 1320], 0.07, math.sin, amp=0.4, curve=3.0))
# 技能释放
save("skill", sweep(0.26, 420, 1250, math.sin, curve=3.5, amp=0.45))
# 治疗
save("heal", mix(tone_seq([523], 0.3, math.sin, amp=0.25, curve=3.0),
                 tone_seq([659], 0.3, math.sin, amp=0.2, curve=3.0),
                 tone_seq([784], 0.3, math.sin, amp=0.18, curve=3.0)))
# UI 点击
save("ui", sweep(0.05, 1400, 900, math.sin, curve=7.0, amp=0.35))
# 开场号角
save("start", tone_seq([392, 523, 659, 784], 0.14, sq, amp=0.22, curve=2.5))
# 必杀技释放：能量爆发
save("ult", mix(sweep(0.45, 220, 880, saw, curve=3.0, amp=0.3),
                sweep(0.45, 440, 1760, math.sin, curve=3.5, amp=0.25),
                noise_burst(0.3, lp=0.3, curve=5.0, amp=0.3)))
