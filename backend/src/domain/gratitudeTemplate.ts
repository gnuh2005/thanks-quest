export interface GratitudeInput {
  recipient?: string;
  memory?: string;
  learned?: string;
  thanks?: string;
  message?: string;
}

export interface GratitudeVersions {
  title: string;
  titleSuggestions: string[];
  versions: { short: string; formal: string; emotional: string };
}

const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();
const endSentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

/**
 * Chế độ mẫu (không dùng AI): chỉ sắp xếp lại đúng những gì người dùng đã nhập,
 * không thêm kỷ niệm hay sự kiện nào mới.
 */
export function buildTemplateVersions(input: GratitudeInput): GratitudeVersions {
  const who = clean(input.recipient) || 'thầy cô';
  const memory = clean(input.memory);
  const learned = clean(input.learned);
  const thanks = clean(input.thanks);
  const message = clean(input.message);

  const parts = {
    memory: memory ? endSentence(memory) : '',
    learned: learned ? endSentence(`Em đã học được ${learned.replace(/^em\s+(đã\s+)?học được\s+/i, '')}`) : '',
    thanks: thanks ? endSentence(`Em muốn cảm ơn ${who} vì ${thanks.replace(/^vì\s+/i, '')}`) : '',
    message: message ? endSentence(message) : '',
  };
  const body = [parts.memory, parts.learned, parts.thanks, parts.message].filter(Boolean);
  const core = body.length ? body.join(' ') : `Em xin gửi lời cảm ơn chân thành đến ${who}.`;

  return {
    title: `Lời cảm ơn gửi ${who}`,
    titleSuggestions: [`Lời cảm ơn gửi ${who}`, 'Điều em muốn nói', 'Người dẫn đường của em'],
    versions: {
      short: [parts.thanks || parts.message || parts.memory || core, `Em cảm ơn ${who}.`].join(' ').trim(),
      formal: `Kính gửi ${who},\n\n${core}\n\nEm xin chân thành cảm ơn.`,
      emotional: `${who[0]?.toUpperCase() ?? ''}${who.slice(1)} ơi,\n\n${core}\n\nCảm ơn ${who} rất nhiều.`,
    },
  };
}
