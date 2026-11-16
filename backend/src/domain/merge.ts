export interface RewardEventLite {
  sourceKey: string;
  kind: 'xp' | 'item' | 'marker';
  itemId?: string;
  amount: number;
  source?: string;
}

/**
 * Quy tắc chuyển tiến độ Guest → tài khoản:
 * chỉ chuyển những sự kiện thưởng mà tài khoản CHƯA có cùng `sourceKey`.
 * Nhờ vậy cùng một nhiệm vụ/vật phẩm/mini game không bao giờ được cộng hai lần,
 * còn các phần thưởng khác nhau của hai bên đều được giữ lại.
 */
export function planTransfer(guestEvents: RewardEventLite[], existingUserKeys: ReadonlySet<string>): RewardEventLite[] {
  const seen = new Set<string>();
  const out: RewardEventLite[] = [];
  for (const ev of guestEvents) {
    if (existingUserKeys.has(ev.sourceKey) || seen.has(ev.sourceKey)) continue;
    seen.add(ev.sourceKey);
    out.push(ev);
  }
  return out;
}

export function unionArrays(...lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())];
}

/** Tổng XP sẽ được cộng thêm cho tài khoản sau khi áp dụng kế hoạch chuyển. */
export function xpOf(events: RewardEventLite[]): number {
  return events.filter((e) => e.kind === 'xp').reduce((s, e) => s + e.amount, 0);
}
