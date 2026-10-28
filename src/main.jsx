import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const seedLogs = [
  { time: '10:41:02', level: 'INFO', service: 'Order listener', message: 'Received order #10482 from checkout.' },
  { time: '10:41:03', level: 'INFO', service: 'Enricher', message: 'Customer profile enriched successfully.' },
  { time: '10:41:04', level: 'ERROR', service: 'CRM connector', message: 'ValidationError: required field email was not supplied.' },
  { time: '10:41:04', level: 'WARN', service: 'Retry guard', message: 'Auto-retry paused: schema error requires human approval.' }
]

const healthyLogs = [
  { time: '10:40:31', level: 'INFO', service: 'Order listener', message: 'Received order #10481 from checkout.' },
  { time: '10:40:32', level: 'INFO', service: 'CRM connector', message: 'Lead C-4812 created successfully.' },
  { time: '10:40:33', level: 'INFO', service: 'Receipt service', message: 'Workflow completed in 1.3s.' }
]

const demoDiagnosis = {
  rootCause: 'The source payload uses customer_email, while the CRM action requires email.',
  confidence: 96,
  evidence: [
    'ValidationError: required field email was not supplied.',
    'Payload inspection shows customer_email exists with a valid value.',
    'The upstream order event completed successfully before the CRM step.'
  ],
  patch: {
    operation: 'Add field mapping',
    before: 'lead.email = payload.email',
    after: 'lead.email = payload.email ?? payload.customer_email'
  },
  validation: [
    'Replay the captured event in dry-run mode.',
    'Verify a CRM lead is created exactly once.',
    'Confirm the workflow emits a success receipt.'
  ],
  risk: 'Low — the change only provides a backwards-compatible fallback for a required field.',
  summary: 'A schema mismatch blocked lead creation. The proposed mapping is safe to retry after approval.'
}

const initialEvents = [
  { label: 'Monitor online', detail: 'Watching Order → CRM sync', tone: 'good' },
  { label: 'Last healthy run', detail: 'Order #10481 completed in 1.3s', tone: 'muted' }
]

function App() {
  const [phase, setPhase] = useState('healthy')
  const [logs, setLogs] = useState(healthyLogs)
  const [events, setEvents] = useState(initialEvents)
  const [diagnosis, setDiagnosis] = useState(null)
  const [aiSource, setAiSource] = useState('')
  const [lastCheck, setLastCheck] = useState(new Date())
  const [recoveryId, setRecoveryId] = useState(() => localStorage.getItem('recoverflow-last-recovery') || '—')

  useEffect(() => {
    const timer = setInterval(() => setLastCheck(new Date()), 4000)
    return () => clearInterval(timer)
  }, [])

  const status = useMemo(() => {
    if (phase === 'healthy') return { label: 'HEALTHY', tone: 'good', detail: 'All monitored actions are completing normally.' }
    if (phase === 'failed') return { label: 'ACTION REQUIRED', tone: 'danger', detail: 'A safe retry is paused until a human reviews the diagnosis.' }
    if (phase === 'diagnosing') return { label: 'ANALYSING', tone: 'warning', detail: 'The AI is correlating logs and building a reversible fix.' }
    if (phase === 'diagnosed') return { label: 'AWAITING APPROVAL', tone: 'warning', detail: 'Review the proposed patch before modifying the workflow.' }
    if (phase === 'patched') return { label: 'PATCH READY', tone: 'info', detail: 'Patch prepared. Validation has not run yet.' }
    if (phase === 'validating') return { label: 'VALIDATING', tone: 'info', detail: 'Replaying the event in a controlled dry run.' }
    return { label: 'RECOVERED', tone: 'good', detail: 'The corrected workflow retried successfully.' }
  }, [phase])

  const addEvent = (label, detail, tone = 'muted') => setEvents((items) => [{ label, detail, tone }, ...items].slice(0, 7))

  function injectFailure() {
    setPhase('failed')
    setDiagnosis(null)
    setAiSource('')
    setLogs(seedLogs)
    setEvents([{ label: 'Failure injected', detail: 'CRM email field intentionally mismatched', tone: 'danger' }, ...initialEvents])
  }

  async function runDiagnosis() {
    setPhase('diagnosing')
    addEvent('AI diagnosis started', 'Analysing the failed run and proposing a reversible correction', 'info')
    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'Order → CRM lead sync', logs })
      })
      const data = await response.json()
      setDiagnosis(data.diagnosis || demoDiagnosis)
      setAiSource(data.source || 'Local demo diagnosis')
      setPhase('diagnosed')
      addEvent('Root cause identified', 'Schema mismatch isolated with high confidence', 'warning')
    } catch {
      setDiagnosis(demoDiagnosis)
      setAiSource('Local demo diagnosis')
      setPhase('diagnosed')
      addEvent('Local diagnosis loaded', 'API was unavailable; demo recovery remains functional', 'warning')
    }
  }

  function approvePatch() {
    setPhase('patched')
    addEvent('Human approval recorded', 'Field-mapping patch approved for dry-run validation', 'info')
  }

  function validateAndRetry() {
    setPhase('validating')
    addEvent('Dry run started', 'Replaying Order #10482 with the proposed patch', 'info')
    window.setTimeout(() => {
      const id = `RCV-${Math.floor(1000 + Math.random() * 8999)}`
      setRecoveryId(id)
      localStorage.setItem('recoverflow-last-recovery', id)
      setPhase('recovered')
      setLogs([
        ...seedLogs,
        { time: '10:43:16', level: 'INFO', service: 'Patch validator', message: 'Dry run passed: CRM lead created exactly once.' },
        { time: '10:43:17', level: 'SUCCESS', service: 'Retry worker', message: 'Order #10482 recovered successfully in 1.6s.' }
      ])
      addEvent('Recovery verified', `${id} • CRM lead created and receipt delivered`, 'good')
    }, 1100)
  }

  function resetDemo() {
    setPhase('healthy')
    setLogs(healthyLogs)
    setDiagnosis(null)
    setAiSource('')
    setEvents(initialEvents)
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">↻</span><span>Recover<span>Flow</span><b>AI</b></span></div>
        <div className="live"><i></i> MONITORING LIVE <small>Checked {lastCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small></div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">SELF-HEALING AUTOMATION CONTROL ROOM</p>
          <h1>Detect. Diagnose. <em>Recover.</em></h1>
          <p className="lead">A monitored Order-to-CRM workflow that pauses safely, finds the likely cause, asks a human, and proves its own recovery.</p>
        </div>
        <button className="reset" onClick={resetDemo}>Reset demo</button>
      </section>

      <section className="status-card">
        <div className={`status-orb ${status.tone}`}><span></span></div>
        <div><p className={`status-label ${status.tone}`}>{status.label}</p><h2>Order → CRM lead sync</h2><p>{status.detail}</p></div>
        <div className="metrics"><div><b>{phase === 'recovered' ? '100%' : phase === 'failed' ? '72%' : '99.8%'}</b><span>Success rate</span></div><div><b>{recoveryId}</b><span>Last recovery</span></div></div>
      </section>

      <section className="flow-card">
        <div className="card-title"><div><p className="eyebrow">LIVE WORKFLOW</p><h2>Order fulfilment automation</h2></div><span className="pill">SIMULATED BUSINESS TOOLS</span></div>
        <div className="flow">
          {['Checkout event', 'Enrich customer', 'Create CRM lead', 'Send receipt'].map((step, index) => {
            const isFailure = phase !== 'healthy' && phase !== 'recovered' && index === 2
            const recovered = phase === 'recovered' && index === 2
            return <div className="flow-wrap" key={step}><div className={`flow-node ${isFailure ? 'failed' : recovered ? 'recovered' : ''}`}><b>{isFailure ? '!' : recovered ? '✓' : index + 1}</b><span>{step}</span><small>{isFailure ? 'Paused safely' : recovered ? 'Recovered' : 'Complete'}</small></div>{index < 3 && <div className={`flow-line ${isFailure ? 'broken' : ''}`}></div>}</div>
          })}
        </div>
        <div className="workflow-actions">
          <button className="secondary" onClick={injectFailure} disabled={phase === 'diagnosing' || phase === 'validating'}>⚡ Inject schema failure</button>
          {phase === 'failed' && <button className="primary" onClick={runDiagnosis}>Run AI diagnosis →</button>}
          {phase === 'diagnosed' && <button className="primary" onClick={approvePatch}>Approve safe patch →</button>}
          {phase === 'patched' && <button className="primary" onClick={validateAndRetry}>Validate & retry →</button>}
          {(phase === 'diagnosing' || phase === 'validating') && <button className="primary" disabled>Working…</button>}
          {phase === 'recovered' && <button className="primary" onClick={injectFailure}>Run another recovery →</button>}
        </div>
      </section>

      <section className="grid">
        <article className="panel logs"><div className="panel-head"><div><p className="eyebrow">OBSERVABILITY</p><h2>Execution logs</h2></div><span className="dot-label"><i></i> STREAMING</span></div>
          <div className="terminal">{logs.map((log, i) => <div className="log" key={`${log.time}-${i}`}><time>{log.time}</time><span className={`level ${log.level.toLowerCase()}`}>{log.level}</span><b>{log.service}</b><p>{log.message}</p></div>)}</div>
        </article>

        <article className="panel timeline"><div className="panel-head"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Recovery timeline</h2></div></div>
          <ol>{events.map((event, i) => <li key={`${event.label}-${i}`}><span className={event.tone}></span><div><b>{event.label}</b><p>{event.detail}</p></div></li>)}</ol>
        </article>
      </section>

      {(diagnosis || phase === 'diagnosing') && <section className="diagnosis-card">
        <div className="diagnosis-head"><div><p className="eyebrow">{aiSource || 'GROQ AI DIAGNOSIS'}</p><h2>{phase === 'diagnosing' ? 'Correlating logs…' : 'A reversible fix is ready for review'}</h2></div>{diagnosis && <div className="confidence"><b>{diagnosis.confidence}%</b><span>confidence</span></div>}</div>
        {phase === 'diagnosing' ? <div className="loading"><i></i><i></i><i></i> Reading the failure trail and checking a safe corrective action.</div> : <div className="diagnosis-grid">
          <div><h3>Likely root cause</h3><p>{diagnosis.rootCause}</p><h3>Evidence</h3><ul>{diagnosis.evidence.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="patch"><h3>Proposed patch <span>HUMAN APPROVAL REQUIRED</span></h3><p className="patch-op">{diagnosis.patch.operation}</p><code><del>{diagnosis.patch.before}</del><ins>{diagnosis.patch.after}</ins></code><p className="risk">{diagnosis.risk}</p><h3>Validation plan</h3><ol>{diagnosis.validation.map((x) => <li key={x}>{x}</li>)}</ol></div>
        </div>}
      </section>}

      <footer>RecoverFlow AI • A safe, explainable self-healing automation MVP</footer>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)

