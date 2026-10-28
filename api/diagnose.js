const fallbackDiagnosis = {
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

function cleanDiagnosis(value) {
  if (!value || typeof value !== 'object') return fallbackDiagnosis
  return {
    rootCause: String(value.rootCause || fallbackDiagnosis.rootCause).slice(0, 500),
    confidence: Math.max(0, Math.min(100, Number(value.confidence) || fallbackDiagnosis.confidence)),
    evidence: Array.isArray(value.evidence) ? value.evidence.slice(0, 4).map(String) : fallbackDiagnosis.evidence,
    patch: {
      operation: String(value.patch?.operation || fallbackDiagnosis.patch.operation),
      before: String(value.patch?.before || fallbackDiagnosis.patch.before),
      after: String(value.patch?.after || fallbackDiagnosis.patch.after)
    },
    validation: Array.isArray(value.validation) ? value.validation.slice(0, 4).map(String) : fallbackDiagnosis.validation,
    risk: String(value.risk || fallbackDiagnosis.risk).slice(0, 350),
    summary: String(value.summary || fallbackDiagnosis.summary).slice(0, 500)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST for a diagnosis.' })
    return
  }

  const logs = Array.isArray(req.body?.logs) ? req.body.logs.slice(-12) : []
  const workflow = String(req.body?.workflow || 'Order-to-CRM sync').slice(0, 120)
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    res.status(200).json({ diagnosis: fallbackDiagnosis, source: 'Local demo diagnosis' })
    return
  }

  const prompt = `You are a cautious SRE diagnosing one failed business automation.\nWorkflow: ${workflow}\nLogs: ${JSON.stringify(logs)}\n\nReturn JSON only with rootCause, confidence (0-100), evidence (array), patch {operation,before,after}, validation (array), risk, summary. Propose the smallest reversible correction. Do not claim the patch was applied.`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.15,
        max_tokens: 650,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return valid JSON only. Never include secrets or make destructive recommendations.' },
          { role: 'user', content: prompt }
        ]
      })
    })

    if (!response.ok) throw new Error(`Groq returned ${response.status}`)
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const diagnosis = cleanDiagnosis(JSON.parse(content))
    res.status(200).json({ diagnosis, source: 'Groq AI diagnosis' })
  } catch {
    // The guided demo remains usable if an API quota or model is temporarily unavailable.
    res.status(200).json({ diagnosis: fallbackDiagnosis, source: 'Local demo fallback' })
  }
}

