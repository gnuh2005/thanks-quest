/**
 * Xuất bản đồ thế giới game sang Tiled JSON (tương thích Tiled Map Editor) cho Phaser.
 *   npm run export-maps   →   ../frontend/public/maps/<areaId>.json
 * Có thể mở các file này bằng Tiled để chỉnh sửa trực quan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREA_MAPS, SOLID, TILE, type AreaMap } from '../seed/data/maps.js';

// gid trong tileset sinh bằng code ở client (xem frontend/src/game/systems/tileset.ts)
export const GID = { grass: 1, path: 2, floor: 3, water: 4, wall: 5, tree: 6, shelf: 7, desk: 8, flower: 9, statue: 10, hedge: 11, rug: 12, door: 13 } as const;

function layers(m: AreaMap) {
  const grass: number[] = [], ground: number[] = [], road: number[] = [], buildings: number[] = [], deco: number[] = [], collision: number[] = [];
  for (const row of m.grid) {
    for (const c of row) {
      let gr = 0, gd = 0, rd = 0, bd = 0, dc = 0;
      switch (c) {
        case '.': gr = GID.grass; break;
        case ',': rd = GID.path; if (!m.indoor) gr = GID.grass; else gd = GID.floor; break;
        case '_': gd = GID.floor; break;
        case '~': gd = GID.water; break;
        case '#': gd = m.indoor ? GID.floor : 0; gr = m.indoor ? 0 : GID.grass; bd = GID.wall; break;
        case 'T': gr = GID.grass; dc = GID.tree; break;
        case 'B': gd = GID.floor; dc = GID.shelf; break;
        case 'C': gd = GID.floor; dc = GID.desk; break;
        case 'F': gr = GID.grass; dc = GID.flower; break;
        case 'S': if (m.indoor) gd = GID.floor; else gr = GID.grass; dc = GID.statue; break;
        case 'H': gr = GID.grass; dc = GID.hedge; break;
        case 'R': gd = GID.floor; rd = GID.rug; break;
        case 'D': if (m.indoor) gd = GID.floor; else gr = GID.grass; rd = GID.door; break;
        default: gr = GID.grass;
      }
      grass.push(gr); ground.push(gd); road.push(rd); buildings.push(bd); deco.push(dc);
      collision.push(SOLID.has(c) ? 1 : 0);
    }
  }
  return { grass, ground, road, buildings, deco, collision };
}

export function toTiled(m: AreaMap) {
  const l = layers(m);
  let nextId = 1;
  const tileLayer = (name: string, data: number[], visible = true) => ({
    id: nextId++, name, type: 'tilelayer', width: m.cols, height: m.rows, x: 0, y: 0, opacity: 1, visible, data,
  });
  const obj = (o: Record<string, unknown>) => ({ id: nextId++, rotation: 0, visible: true, ...o });
  const props = (p: Record<string, string | number | boolean>) =>
    Object.entries(p).filter(([, v]) => v !== undefined).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value }));

  return {
    compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
    width: m.cols, height: m.rows, tilewidth: TILE, tileheight: TILE, infinite: false, nextlayerid: 99, nextobjectid: 9999,
    properties: props({ areaId: m.areaId, indoor: m.indoor }),
    tilesets: [{ firstgid: 1, name: 'world', tilewidth: TILE, tileheight: TILE, tilecount: 13, columns: 13, image: 'generated', imagewidth: TILE * 13, imageheight: TILE }],
    layers: [
      tileLayer('Grass', l.grass),
      tileLayer('Ground', l.ground),
      tileLayer('Road', l.road),
      tileLayer('Buildings', l.buildings),
      tileLayer('Decoration', l.deco),
      tileLayer('Collision', l.collision, false),
      {
        id: nextId++, name: 'Interaction', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown',
        objects: [
          ...m.portals.map((p) => obj({ name: p.id, type: 'portal', x: p.x * TILE, y: p.y * TILE, width: p.w * TILE, height: p.h * TILE,
            properties: props({ to: p.to, spawn: p.spawn, label: p.label }) })),
          ...m.pois.map((p) => obj({ name: p.poiId, type: 'poi', x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2, width: 0, height: 0, point: true,
            properties: props({ poiType: p.type, label: p.label, ref: p.ref ?? '', itemId: p.itemId ?? '', text: p.text ?? '' }) })),
        ],
      },
      {
        id: nextId++, name: 'Objects', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown',
        objects: [
          ...m.npcs.map((n) => obj({ name: n.npcId, type: 'npc', x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2, width: 0, height: 0, point: true })),
          ...Object.entries(m.spawns).map(([name, [x, y]]) => obj({ name, type: 'spawn', x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, width: 0, height: 0, point: true })),
        ],
      },
    ],
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(here, '../../../frontend/public/maps');
  fs.mkdirSync(out, { recursive: true });
  for (const m of AREA_MAPS) {
    fs.writeFileSync(path.join(out, `${m.areaId}.json`), JSON.stringify(toTiled(m)));
    console.log(`✔ ${m.areaId}.json (${m.cols}×${m.rows})`);
  }
}
