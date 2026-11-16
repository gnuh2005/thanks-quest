import { useEffect, useState } from 'react'
import { CheckCircle2, Gift, RotateCcw, Trophy, XCircle } from 'lucide-react'
import { Btn, Modal } from '../ui/Modal'
import { DebugGame, MemoryGame, QuizGame, TreasureGame, type GameProps } from './games'
import { miniApi } from '../../services/gameApi'
import { ApiError } from '../../services/api'
import { useGame } from '../../stores/game'
import { EventBus } from '../../game/events/EventBus'
import type { Acted, MiniGameInfo } from '../../types/api'
import { vi } from '../../i18n'

type Phase =
  | { kind: 'loading' }
  | { kind: 'intro' }
  | { kind: 'playing'; attempt: Record<string, any> }
  | { kind: 'result'; res: Acted }
  | { kind: 'error'; message: string }

const GAMES: Record<MiniGameInfo['type'], (p: GameProps) => React.ReactElement> = {
  quiz: QuizGame, memory: MemoryGame, debug: DebugGame, treasure: TreasureGame,
}

export function MiniGameHost({ minigameId, onClose, onRequireAccount }: { minigameId: string; onClose: () => void; onRequireAccount: (reason: string) => void }) {
  const [info, setInfo] = useState<MiniGameInfo | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const { commit, toast } = useGame()

  useEffect(() => {
    let off = false
    miniApi.get(minigameId)
      .then((r) => { if (!off) { setInfo(r.minigame); setPhase({ kind: 'intro' }) } })
      .catch((e) => !off && setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : 'Không tải được mini game' }))
    return () => { off = true }
  }, [minigameId])

  const start = async () => {
    setPhase({ kind: 'loading' })
    try {
      const { attempt } = await miniApi.start(minigameId)
      setPhase({ kind: 'playing', attempt })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_REQUIRED') return onRequireAccount(e.message)
      setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : 'Không bắt đầu được lượt chơi' })
    }
  }

  const submitFor = (attempt: Record<string, any>) => async (answer: unknown) => {
    try {
      const res = await miniApi.submit(minigameId, attempt.attemptId as string, answer)
      commit(res)
      if (res.outcome.passed) EventBus.emit('player:action', 'celebrate')
      setPhase({ kind: 'result', res })
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : 'Không nộp được bài' })
    }
  }

  const title = vi(info?.name ?? 'Trò chơi nhỏ')
  const Game = info ? GAMES[info.type] : null

  return (
    <Modal title={title} onClose={phase.kind === 'playing' ? undefined : onClose} locked={phase.kind === 'playing'} wide>
      {phase.kind === 'loading' && <p className="py-10 text-center text-white/60" role="status">Đang tải…</p>}

      {phase.kind === 'error' && (
        <div className="py-6 text-center" role="alert" data-testid="mg-error">
          <p className="text-red-300">{phase.message}</p>
          <div className="mt-4 flex justify-center gap-2"><Btn kind="ghost" onClick={onClose}>Đóng</Btn><Btn onClick={start}>Thử lại</Btn></div>
        </div>
      )}

      {phase.kind === 'intro' && info && (
        <div data-testid="mg-intro">
          <p className="text-white/80">{vi(info.description)}</p>
          <h3 className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wider text-cyan">Cách chơi</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-white/75">{info.instructions.map((t) => <li key={t}>{vi(t)}</li>)}</ul>
          {info.reward && (
            <p className="mt-4 flex items-center gap-2 text-sm text-gold"><Gift size={15} aria-hidden /> Thưởng lần đầu: +{info.reward.first ?? 0} điểm kinh nghiệm{info.reward.perfect ? ` · Hoàn hảo: +${info.reward.perfect} điểm kinh nghiệm` : ''}</p>
          )}
          <div className="mt-5 flex justify-end gap-2"><Btn kind="ghost" onClick={onClose}>Để sau</Btn><Btn onClick={start} testId="mg-start">Bắt đầu</Btn></div>
        </div>
      )}

      {phase.kind === 'playing' && Game && info && (
        <Game minigameId={minigameId} attempt={phase.attempt} submit={submitFor(phase.attempt)} onError={(m) => toast({ kind: 'error', title: m })} />
      )}

      {phase.kind === 'result' && info && <Result info={info} res={phase.res} onAgain={start} onClose={onClose} />}
    </Modal>
  )
}

function Result({ info, res, onAgain, onClose }: { info: MiniGameInfo; res: Acted; onAgain: () => void; onClose: () => void }) {
  const o = res.outcome
  const r = (o.result ?? {}) as Record<string, any>
  const passed = !!o.passed
  const g = o.grant

  useEffect(() => {
    EventBus.emit('audio:playSfx', passed ? 'minigameCorrect' : 'minigameWrong')
  }, [passed])
  return (
    <div data-testid="mg-result" data-passed={passed}>
      <div className="flex items-center gap-3">
        {passed ? <Trophy className="text-gold" size={34} aria-hidden /> : <XCircle className="text-red-400" size={34} aria-hidden />}
        <div>
          <h3 className="text-xl font-extrabold">{r.expired ? 'Hết thời gian' : r.invalid ? 'Bài nộp không hợp lệ' : passed ? (r.perfect ? 'Hoàn hảo!' : 'Vượt qua thử thách!') : 'Chưa đạt, thử lại nhé'}</h3>
          <p className="text-sm text-white/65">
            {info.type === 'quiz' && `Đúng ${r.correct}/${r.total} câu (${r.percent}%)`}
            {info.type === 'memory' && !r.invalid && `${r.moves} lượt · ${'★'.repeat(r.stars ?? 0)}${'☆'.repeat(3 - (r.stars ?? 0))}`}
            {info.type === 'debug' && `Sửa đúng ${r.passedCount}/${r.total} bài`}
            {info.type === 'treasure' && `Tìm được ${r.found}/${r.total} kho báu trong ${r.digsUsed} lượt đào`}
            {r.invalid && (r.reason ?? '')}
          </p>
        </div>
      </div>

      {(g?.xp || (g?.items?.length ?? 0) > 0) ? (
        <p className="mt-4 rounded-lg bg-gold/10 p-3 text-sm text-gold" data-testid="mg-reward">
          Phần thưởng: {g?.xp ? `+${g.xp} điểm kinh nghiệm` : ''}{g?.items?.map((i) => ` · ${vi(i.itemId.replace(/_/g, ' '))} ×${i.qty}`).join('')}
        </p>
      ) : passed ? (
        <p className="mt-4 rounded-lg bg-white/5 p-3 text-xs text-white/60" data-testid="mg-reward-none">Bạn đã nhận phần thưởng lần đầu; thưởng chơi lại bị giới hạn mỗi ngày để chống lạm dụng.</p>
      ) : null}
      {g?.capped && <p className="mt-2 text-xs text-gold">Đã chạm giới hạn điểm kinh nghiệm của chế độ chơi thử — đăng ký để tiếp tục tích lũy.</p>}

      {Array.isArray(r.details) && info.type !== 'treasure' && (
        <ol className="mt-4 space-y-2" data-testid="mg-details">
          {r.details.map((d: any, i: number) => (
            <li key={d.qid} className="flex gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
              {d.correct ? <CheckCircle2 className="mt-0.5 shrink-0 text-cyan" size={17} aria-label="Đúng" /> : <XCircle className="mt-0.5 shrink-0 text-red-400" size={17} aria-label="Sai" />}
              <div>
                <p className="font-semibold">{info.type === 'quiz' ? `Câu ${i + 1}` : `Bài ${i + 1}`}: {d.correct ? 'Đúng' : 'Chưa đúng'}</p>
                {d.explanation && <p className="text-xs text-white/65">{vi(d.explanation)}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Btn kind="ghost" onClick={onAgain}><RotateCcw size={15} /> Chơi lại</Btn>
        <Btn onClick={onClose} testId="mg-close">Tiếp tục khám phá</Btn>
      </div>
    </div>
  )
}
