import 'server-only'

export function studioAgentMode(): 'live' | 'mock' {
  const configured = process.env.OPENAI_STUDIO_MODE?.trim().toLowerCase()
  if (configured === 'live' || configured === 'mock') return configured
  return process.env.OPENAI_API_KEY ? 'live' : 'mock'
}
