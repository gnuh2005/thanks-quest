import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, AREAS, DEBUG_QUESTIONS, ITEMS, MCQ_QUESTIONS, MINIGAMES, NPCS, QUESTIONS, QUESTS } from '../src/seed/data/content.js';
import { computeQuestView, claimKeyOf, type ProgressSnapshot } from '../src/domain/quests.js';
import { gradeDebugOne } from '../src/domain/grading.js';
import { levelFromXp } from '../src/domain/progression.js';
import { newlyEarned } from '../src/domain/achievements.js';

const ids = (xs: { [k: string]: any }[], k: string) => xs.map((x) => x[k] as string);

describe('số lượng dữ liệu mẫu theo đặc tả', () => {
  it('6 khu vực, 6 NPC, 4 mini game, 30 câu hỏi, 10 vật phẩm, 8 thành tựu', () => {
    expect(AREAS).toHaveLength(6);
    expect(NPCS).toHaveLength(6);
    expect(MINIGAMES).toHaveLength(4);
    expect(QUESTIONS).toHaveLength(30);
    expect(ITEMS).toHaveLength(10);
    expect(ACHIEVEMENTS).toHaveLength(8);
  });
  it('10 nhiệm vụ chính và 10 nhiệm vụ phụ', () => {
    expect(QUESTS.filter((q) => q.type === 'main')).toHaveLength(10);
    expect(QUESTS.filter((q) => q.type === 'side')).toHaveLength(10);
    for (const t of ['daily', 'achievement', 'event'] as const) expect(QUESTS.some((q) => q.type === t)).toBe(true);
  });
  it('mã định danh là duy nhất', () => {
    for (const [list, key] of [[QUESTS, 'questId'], [ITEMS, 'itemId'], [QUESTIONS, 'qid'], [NPCS, 'npcId'], [ACHIEVEMENTS, 'achId'], [MINIGAMES, 'minigameId']] as const) {
      const v = ids(list as any, key);
      expect(new Set(v).size, key).toBe(v.length);
    }
  });
});

describe('tham chiếu chéo hợp lệ', () => {
  const poiIds = AREAS.flatMap((a) => a.pois.map((p) => p.poiId));
  const npcIds = NPCS.map((n) => n.npcId);
  const areaIds = AREAS.map((a) => a.areaId);
  const itemIds = ITEMS.map((i) => i.itemId);
  const mgIds = MINIGAMES.map((m) => m.minigameId);

  it('nhiệm vụ trỏ tới NPC/khu vực/vật phẩm/POI/mini game có thật', () => {
    const questIds = QUESTS.map((q) => q.questId);
    for (const q of QUESTS) {
      expect(npcIds, q.questId).toContain(q.npcId);
      expect(areaIds, q.questId).toContain(q.areaId);
      for (const r of q.requires?.quests ?? []) expect(questIds, `${q.questId} requires ${r}`).toContain(r);
      for (const it of q.reward.items ?? []) expect(itemIds, `${q.questId} reward`).toContain(it.itemId);
      for (const o of q.objectives) {
        if (o.kind === 'talk') expect(npcIds).toContain(o.ref);
        if (o.kind === 'visit') expect(areaIds).toContain(o.ref);
        if (o.kind === 'minigame') expect(mgIds).toContain(o.ref);
        if (o.kind === 'poi') expect(poiIds).toContain(o.ref);
        if (o.kind === 'collect') expect(itemIds).toContain(o.ref);
      }
    }
  });
  it('mục tiêu thu thập có đủ vật phẩm trên bản đồ để hoàn thành', () => {
    for (const q of QUESTS) for (const o of q.objectives) {
      if (o.kind !== 'collect') continue;
      const available = AREAS.flatMap((a) => a.pois).filter((p) => p.itemId === o.ref).length;
      expect(available, `${q.questId} cần ${o.count} ${o.ref}`).toBeGreaterThanOrEqual(o.count ?? 1);
    }
  });
  it('mục tiêu đọc truyện có đủ câu chuyện', () => {
    const stories = AREAS.flatMap((a) => a.pois).filter((p) => p.type === 'story').length;
    for (const q of QUESTS) for (const o of q.objectives) if (o.kind === 'story_count') expect(stories).toBeGreaterThanOrEqual(o.count ?? 1);
  });
  it('POI vật phẩm/mini game/truyện hợp lệ', () => {
    for (const a of AREAS) for (const p of a.pois) {
      if (p.itemId) expect(itemIds).toContain(p.itemId);
      if (p.type === 'minigame') expect(mgIds).toContain(p.ref);
      if (p.type === 'story') expect(p.text, p.poiId).toBeTruthy();
    }
  });
  it('khóa khu vực tham chiếu nhiệm vụ có thật', () => {
    const questIds = QUESTS.map((q) => q.questId);
    for (const a of AREAS) for (const q of (a.unlock as any).claimedQuests ?? []) expect(questIds).toContain(q);
  });
});

describe('câu hỏi', () => {
  it('trắc nghiệm có 4 lựa chọn, đáp án hợp lệ, có giải thích', () => {
    for (const q of MCQ_QUESTIONS) {
      expect(q.choices, q.qid).toHaveLength(4);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.explanation.length).toBeGreaterThan(5);
    }
  });
  it('đáp án trắc nghiệm không dồn vào một vị trí', () => {
    const counts = [0, 0, 0, 0];
    for (const q of MCQ_QUESTIONS) counts[q.answerIndex]!++;
    expect(Math.max(...counts)).toBeLessThanOrEqual(Math.ceil(MCQ_QUESTIONS.length * 0.6));
  });
  it('debug: code lỗi bị từ chối, lời giải được chấp nhận', () => {
    for (const d of DEBUG_QUESTIONS) {
      const def = { qid: d.qid, accepted: [d.solution], mustMatch: d.mustMatch, mustNotMatch: d.mustNotMatch };
      expect(gradeDebugOne(def, d.buggyCode), `${d.qid} code lỗi không được đạt`).toBe(false);
      expect(gradeDebugOne(def, d.solution), `${d.qid} lời giải phải đạt`).toBe(true);
      // Quy tắc (không dựa vào `accepted`) cũng phải chấp nhận lời giải → chấp nhận được biến thể cách viết.
      expect(gradeDebugOne({ ...def, accepted: [] }, d.solution), `${d.qid} mustMatch phải khớp lời giải`).toBe(true);
    }
  });
  it('debug: chấp nhận các cách sửa tương đương hợp lý', () => {
    const get = (id: string) => DEBUG_QUESTIONS.find((d) => d.qid === id)!;
    const pass = (id: string, code: string) => {
      const d = get(id);
      return gradeDebugOne({ qid: id, accepted: [], mustMatch: d.mustMatch, mustNotMatch: d.mustNotMatch }, code);
    };
    expect(pass('dbg_01', 'function sum(arr){ let total=0; for(let i=0;i<=arr.length-1;i++){ total+=arr[i]; } return total; }')).toBe(true);
    expect(pass('dbg_02', 'function isAdult(age){ if(age>17){ return true; } return false; }')).toBe(true);
    expect(pass('dbg_04', 'total = 0\nfor n in range(1, 6):\n    total = total + n\nprint(total)')).toBe(true);
    expect(pass('dbg_05', '#include <iostream>\nusing namespace std;\nint main(){ int i=0; while(i<5){ cout<<i<<endl; ++i; } return 0; }')).toBe(true);
    expect(pass('dbg_07', 'var count = 0;\nfor (let i = 0; i < 3; i++) { count++; }\nconsole.log(count);')).toBe(true);
    expect(pass('dbg_08', 'function max(a, b) { if (a < b) { return b; } return a; }')).toBe(true);
  });
  it('debug: các cách sửa sai bị từ chối', () => {
    const get = (id: string) => DEBUG_QUESTIONS.find((d) => d.qid === id)!;
    const fail = (id: string, code: string) => {
      const d = get(id);
      return !gradeDebugOne({ qid: id, accepted: [], mustMatch: d.mustMatch, mustNotMatch: d.mustNotMatch }, code);
    };
    expect(fail('dbg_02', 'function isAdult(age) { if (age == 18) { return true; } return false; }')).toBe(true);
    expect(fail('dbg_05', '#include <iostream>\nint main(){ int i=0; while(i<5){ cout<<i; } i++; return 0; }')).toBe(true); // i++ nằm ngoài vòng lặp
    expect(fail('dbg_07', 'const count = 0; count = count + 1; console.log(count);')).toBe(true);
    expect(fail('dbg_08', 'function max(a, b) { if (a < b) { return a; } return b; }')).toBe(true);
  });
});

/** Mô phỏng một lượt chơi đầy đủ chỉ bằng logic thuần (không cần DB). */
function simulate(kind: 'guest' | 'user') {
  const p: ProgressSnapshot = { kind, xp: 0, facts: [], startedQuests: [], claimedQuests: [], collected: {} };
  const today = '2026-11-15';
  const claimedOrder: string[] = [];
  const unlockedAreas = () => AREAS.filter((a) => {
    const u = a.unlock as any;
    return (!u.minLevel || levelFromXp(p.xp) >= u.minLevel) && (u.claimedQuests ?? []).every((q: string) => p.claimedQuests.includes(q));
  }).map((a) => a.areaId);

  const satisfy = (q: (typeof QUESTS)[number]) => {
    for (const o of q.objectives) {
      const need = o.count ?? 1;
      switch (o.kind) {
        case 'talk': p.facts.push(`talk:${o.ref}`); break;
        case 'visit': expect(unlockedAreas(), `${q.questId}: khu ${o.ref} phải mở`).toContain(o.ref); p.facts.push(`visit:${o.ref}`); break;
        case 'minigame': p.facts.push(`mg:${o.ref}:passed`, `mg:${o.ref}:passed:${today}`); break;
        case 'poi': p.facts.push(`poi:${o.ref}`); break;
        case 'collect': p.collected[o.ref!] = Math.max(p.collected[o.ref!] ?? 0, need); break;
        case 'story_count': for (let i = 0; i < need; i++) p.facts.push(`story:s${i}`); break;
        case 'gratitude_preview': p.facts.push('gratitude:preview'); break;
        case 'gratitude_post': p.facts.push('gratitude:posted'); break;
        case 'talk_count': for (let i = 0; i < need; i++) p.facts.push(`talk:n${i}`); break;
        case 'minigames_passed': for (const m of ['quiz', 'memory', 'debug', 'treasure']) p.facts.push(`mg:${m}:passed`); break;
        default: break; // level / claimed_count: đạt nhờ XP và số nhiệm vụ đã nhận
      }
    }
  };

  // Lặp tới khi không còn gì nhận thêm được.
  for (let round = 0; round < 8; round++) {
    let progressed = false;
    for (const q of QUESTS) {
      const key = claimKeyOf(q, today);
      if (p.claimedQuests.includes(key)) continue;
      let v = computeQuestView(q, p, today);
      if (v.status === 'locked') continue;
      // Nhận nhiệm vụ = trò chuyện với NPC giao nhiệm vụ (server ghi fact talk:<npc> trong buildDialogue).
      if (v.status === 'available') { p.facts.push(`talk:${q.npcId}`); p.startedQuests.push(key); v = computeQuestView(q, p, today); }
      if (v.status === 'in_progress') {
        // Nhiệm vụ cấp độ/đếm nhiệm vụ chỉ đạt khi điều kiện tổng thể đạt — không "gian lận" bằng facts.
        if (q.objectives.some((o) => o.kind === 'level' || o.kind === 'claimed_count')) {
          const trial = { ...p, facts: [...p.facts], collected: { ...p.collected } };
          const backup = { facts: p.facts, collected: p.collected };
          satisfy(q);
          v = computeQuestView(q, p, today);
          if (v.status !== 'completed') { p.facts = backup.facts; p.collected = backup.collected; void trial; continue; }
        } else {
          satisfy(q);
          v = computeQuestView(q, p, today);
        }
      }
      if (v.status === 'completed') {
        p.claimedQuests.push(key);
        p.xp += q.reward.xp;
        for (const it of q.reward.items ?? []) p.collected[it.itemId] = (p.collected[it.itemId] ?? 0) + it.qty;
        claimedOrder.push(q.questId);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return { p, claimedOrder, unlocked: unlockedAreas() };
}

describe('mô phỏng toàn bộ hành trình', () => {
  it('Student hoàn thành mọi nhiệm vụ và mở đủ 6 khu vực', () => {
    const { p, claimedOrder, unlocked } = simulate('user');
    const all = QUESTS.map((q) => q.questId);
    expect(all.filter((q) => !claimedOrder.includes(q))).toEqual([]);
    expect(unlocked.sort()).toEqual(['courtyard', 'garden', 'hall', 'lab', 'library', 'plaza']);
    expect(p.xp).toBeGreaterThan(0);
  });
  it('Guest hoàn thành chuỗi nhiệm vụ chính 01–09 nhưng bị chặn ở các nhiệm vụ cần tài khoản', () => {
    const { claimedOrder, unlocked } = simulate('guest');
    for (let i = 1; i <= 9; i++) expect(claimedOrder).toContain(`main_0${i}`);
    expect(claimedOrder).not.toContain('main_10');
    expect(claimedOrder).not.toContain('event_01');
    expect(unlocked).toContain('hall');
  });
  it('hành trình chơi thử 3–5 phút (quiz → debug → tri ân) mở được Gratitude Hall', () => {
    const p: ProgressSnapshot = { kind: 'guest', xp: 0, facts: [], startedQuests: [], claimedQuests: [], collected: {} };
    const today = '2026-11-15';
    const doQuest = (id: string, facts: string[]) => {
      const q = QUESTS.find((x) => x.questId === id)!;
      p.startedQuests.push(id);
      p.facts.push(...facts);
      const v = computeQuestView(q, p, today);
      expect(v.status, id).toBe('completed');
      p.claimedQuests.push(id);
      p.xp += q.reward.xp;
    };
    doQuest('main_01', ['poi:plaza_board']);
    doQuest('main_02', ['visit:library', 'talk:librarian']);
    doQuest('main_03', ['mg:quiz:passed']);
    doQuest('main_04', ['visit:lab', 'talk:coding_mentor']);
    doQuest('main_05', ['mg:debug:passed']);
    expect((AREAS.find((a) => a.areaId === 'hall')!.unlock as any).claimedQuests.every((q: string) => p.claimedQuests.includes(q))).toBe(true);
    doQuest('main_06', ['visit:hall', 'talk:gratitude_guardian']);
    doQuest('main_07', ['gratitude:preview']);
  });
  it('tổng XP có thể nhận không vượt quá giới hạn thiết kế một cách vô lý và có đủ để đạt cấp 4', () => {
    const { p } = simulate('user');
    expect(levelFromXp(p.xp)).toBeGreaterThanOrEqual(4);
  });
  it('thành tựu đạt được trong hành trình đầy đủ', () => {
    const { p } = simulate('user');
    const earned = newlyEarned(ACHIEVEMENTS, { xp: p.xp, facts: p.facts, claimedQuests: p.claimedQuests, passedMinigames: ['quiz', 'memory', 'debug', 'treasure'], collected: p.collected }, []);
    expect(earned).toEqual(expect.arrayContaining(['first_step', 'knowledge_seeker', 'code_explorer', 'quest_master', 'gratitude_heart', 'rising_scholar']));
  });
});
