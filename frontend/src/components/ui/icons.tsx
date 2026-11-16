import {
  Award, BadgeCheck, BookOpen, Brain, Coffee, Cpu, Footprints, GraduationCap, Gem, Heart, Lightbulb, Mail, NotebookPen, Package, Pencil,
  ScrollText, Sparkles, Sprout, type LucideIcon,
} from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  'book-open': BookOpen, sprout: Sprout, sparkles: Sparkles, 'scroll-text': ScrollText, pencil: Pencil, 'notebook-pen': NotebookPen,
  mail: Mail, lightbulb: Lightbulb, heart: Heart, 'graduation-cap': GraduationCap, gem: Gem, footprints: Footprints, cpu: Cpu,
  coffee: Coffee, brain: Brain, 'badge-check': BadgeCheck, award: Award, package: Package,
}

export function ItemIcon({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) {
  const Icon = MAP[name] ?? Package
  return <Icon size={size} className={className} aria-hidden />
}

export const CATEGORY_LABEL: Record<string, string> = {
  all: 'Tất cả', book: 'Sách', knowledge: 'Tri thức', memory: 'Ký ức', tech: 'Công nghệ', collectible: 'Sưu tầm', event: 'Sự kiện',
}
export const QUEST_TYPE_LABEL: Record<string, string> = {
  main: 'Nhiệm vụ chính', side: 'Nhiệm vụ phụ', daily: 'Nhiệm vụ hằng ngày', achievement: 'Thành tựu', event: 'Sự kiện đặc biệt',
}
export const STATUS_LABEL: Record<string, string> = {
  locked: 'Đang khóa', available: 'Có thể nhận', in_progress: 'Đang thực hiện', completed: 'Hoàn thành', claimed: 'Đã nhận thưởng',
}
