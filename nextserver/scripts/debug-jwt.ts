import './load-env'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY!
  )
  const { data } = await supabase.auth.signInWithPassword({
    email: 'test3@kodo.com',
    password: 'test123',
  })
  const token = data.session!.access_token

  // Decode JWT without a library (header + payload are base64url)
  const [headerB64, payloadB64] = token.split('.')
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

  console.log('Algorithm:', header.alg)
  console.log('sub (auth user id):', payload.sub)
  console.log('email:', payload.email)
  console.log('exp:', new Date(payload.exp * 1000).toISOString())
  console.log('\nCurrent SUPABASE_JWT_SECRET in .env:')
  console.log(' ', process.env.SUPABASE_JWT_SECRET)
  console.log('\n→ Go to Supabase Dashboard → Project Settings → API → JWT Secret')
  console.log('  and compare with the value above.')
}

main()
