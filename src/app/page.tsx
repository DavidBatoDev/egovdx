import { LandingPage } from '@/components/landing/landing-page'
import { egovMode } from '@/lib/egov/client'

export default function HomePage() {
  return <LandingPage liveSso={egovMode('SSO') === 'live'} />
}
