import { describe, it, expect } from 'vitest';
import { AREA_MAPS, SOLID, mapOf, type AreaMap } from '../src/seed/data/maps.js';

function blocked(m: AreaMap): boolean[][] {
  const b = m.grid.map((row) => [...row].map((c) => SOLID.has(c)));
  for (const n of m.npcs) b[n.y]![n.x] = true; // NPC chắn ô
  return b;
}

function reach(m: AreaMap, start: [number, number]): boolean[][] {
  const b = blocked(m);
  const seen = m.grid.map((r) => [...r].map(() => false));
  const q: [number, number][] = [start];
  seen[start[1]]![start[0]] = true;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows) continue;
      if (seen[ny]![nx] || b[ny]![nx]) continue;
      seen[ny]![nx] = true;
      q.push([nx, ny]);
    }
  }
  return seen;
}

describe('bản đồ thế giới game', () => {
  it('có đúng 6 khu vực, lưới đúng kích thước', () => {
    expect(AREA_MAPS.map((a) => a.areaId)).toEqual(['plaza', 'library', 'lab', 'garden', 'courtyard', 'hall']);
    for (const m of AREA_MAPS) {
      expect(m.grid).toHaveLength(m.rows);
      for (const row of m.grid) expect(row).toHaveLength(m.cols);
    }
  });

  it.each(AREA_MAPS.map((m) => [m.areaId, m] as const))('%s: điểm xuất hiện, POI, NPC, cổng đều tới được', (_id, m) => {
    const b = blocked(m);
    for (const [name, [x, y]] of Object.entries(m.spawns)) {
      expect(b[y]![x], `spawn ${name} bị chắn`).toBe(false);
    }
    const seen = reach(m, m.spawns.default!);
    for (const [name, [x, y]] of Object.entries(m.spawns)) expect(seen[y]![x], `spawn ${name} không nối với spawn mặc định`).toBe(true);
    for (const p of m.pois) {
      expect(SOLID.has(m.grid[p.y]![p.x]!), `POI ${p.poiId} nằm trên ô chắn`).toBe(false);
      expect(seen[p.y]![p.x], `POI ${p.poiId} không tới được`).toBe(true);
    }
    for (const n of m.npcs) {
      const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[n.y + dy!]?.[n.x + dx!]);
      expect(adj, `NPC ${n.npcId} không có ô đứng kề`).toBe(true);
    }
    for (const p of m.portals) {
      for (let j = p.y; j < p.y + p.h; j++) for (let i = p.x; i < p.x + p.w; i++) {
        expect(seen[j]![i], `cổng ${p.id} không tới được`).toBe(true);
      }
    }
  });

  it('mọi cổng dẫn tới khu vực và điểm xuất hiện có thật; có thể đi tới đủ 6 khu từ quảng trường', () => {
    const visited = new Set<string>(['plaza']);
    const stack = ['plaza'];
    while (stack.length) {
      const cur = mapOf(stack.pop()!);
      for (const p of cur.portals) {
        const target = mapOf(p.to);
        expect(target.spawns[p.spawn], `${cur.areaId}.${p.id} → spawn ${p.spawn} thiếu`).toBeTruthy();
        if (!visited.has(p.to)) { visited.add(p.to); stack.push(p.to); }
      }
    }
    expect([...visited].sort()).toEqual(['courtyard', 'garden', 'hall', 'lab', 'library', 'plaza']);
  });

  it('mã POI/NPC là duy nhất trên toàn thế giới', () => {
    const pois = AREA_MAPS.flatMap((m) => m.pois.map((p) => p.poiId));
    expect(new Set(pois).size).toBe(pois.length);
    const npcs = AREA_MAPS.flatMap((m) => m.npcs.map((n) => n.npcId));
    expect(new Set(npcs).size).toBe(npcs.length);
  });
});
